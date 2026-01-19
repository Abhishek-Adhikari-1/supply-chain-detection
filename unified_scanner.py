#!/usr/bin/env python3
"""
Unified Supply Chain Scanner - Analyzes projects, unpacked packages, and packed archives
"""

import json
import os
import sys
import tempfile
import tarfile
import zipfile
import pickle
from pathlib import Path
from typing import Dict, List, Tuple, Any

import pandas as pd
import warnings
warnings.filterwarnings('ignore')

# ════════════════════════════════════════════════════════════════════════════════
# MODEL LOADING
# ════════════════════════════════════════════════════════════════════════════════

def load_model():
    """Load pre-trained security model."""
    model_paths = [
        Path(__file__).parent / "data" / "security_model.pkl",
        Path(__file__).parent / "RandomForest" / "security_model.pkl",
    ]
    
    for path in model_paths:
        if path.exists():
            try:
                with open(path, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                print(f"Warning: Failed to load model from {path}: {e}", file=sys.stderr)
    
    raise FileNotFoundError("Could not find security_model.pkl in current or RandomForest directory")


# ════════════════════════════════════════════════════════════════════════════════
# PACKAGE EXTRACTION
# ════════════════════════════════════════════════════════════════════════════════

def extract_tar_gz(tar_path: Path) -> Path:
    """Extract .tar.gz archive and return extraction directory."""
    extract_dir = Path(tempfile.mkdtemp(prefix="pkg_tar_"))
    try:
        with tarfile.open(tar_path, 'r:gz') as tar:
            tar.extractall(path=extract_dir)
        return extract_dir
    except Exception as e:
        print(f"Error extracting {tar_path}: {e}", file=sys.stderr)
        raise


def extract_tgz(tgz_path: Path) -> Path:
    """Extract .tgz archive (same as tar.gz)."""
    return extract_tar_gz(tgz_path)


def extract_zip(zip_path: Path) -> Path:
    """Extract .zip archive and return extraction directory."""
    extract_dir = Path(tempfile.mkdtemp(prefix="pkg_zip_"))
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(path=extract_dir)
        return extract_dir
    except Exception as e:
        print(f"Error extracting {zip_path}: {e}", file=sys.stderr)
        raise


def extract_packed_package(package_path: str) -> Tuple[Path, bool]:
    """
    Extract packed package if needed, or return original path.
    Returns: (extracted_path_or_original, was_extracted)
    """
    path = Path(package_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Package not found: {package_path}")
    
    # If it's a directory, return as-is
    if path.is_dir():
        return path, False
    
    # Extract based on file extension
    if path.suffix == '.gz' or path.name.endswith('.tar.gz'):
        extracted = extract_tar_gz(path)
    elif path.suffix == '.zip':
        extracted = extract_zip(path)
    elif path.suffix == '.tgz':
        extracted = extract_tgz(path)
    else:
        raise ValueError(f"Unsupported archive format: {path.suffix}")
    
    if extracted is None:
        raise RuntimeError(f"Failed to extract {package_path}")
    
    return extracted, True


# ════════════════════════════════════════════════════════════════════════════════
# FILE SCANNING
# ════════════════════════════════════════════════════════════════════════════════

def read_file_safe(path: Path, max_size: int = 1_000_000) -> str:
    """Safely read file content with size limit."""
    try:
        if path.stat().st_size > max_size:
            return f"<FILE TOO LARGE: {path.stat().st_size} bytes>"
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception:
        return ""


def scan_file_for_patterns(content: str) -> Dict[str, int]:
    """Scan file content for security-relevant patterns."""
    import re
    
    patterns = {
        'base64_strings': len(re.findall(r'[A-Za-z0-9+/]{40,}={0,2}', content)),
        'eval_usage': len(re.findall(r'eval\s*\(', content, re.IGNORECASE)),
        'exec_usage': len(re.findall(r'exec\s*\(', content, re.IGNORECASE)),
        'shell_command_exec': len(re.findall(r'(shell_exec|system|exec|passthru|proc_open)\s*\(', content, re.IGNORECASE)),
        'env_var_access': len(re.findall(r'(process\.env|os\.environ|\$ENV)', content)),
        'fernet_usage': len(re.findall(r'Fernet\s*\(', content)),
        'aes_usage': len(re.findall(r'(AES\.new|from.*Crypto\.Cipher)', content)),
        'rsa_usage': len(re.findall(r'RSA\.(generate|import)', content)),
        'network_calls': len(re.findall(r'(requests\.|urllib\.|fetch\s*\(|axios\.)', content)),
        'external_urls': len(re.findall(r'https?://[^\s\'"<>]+', content)),
        'suspicious_urls': len(re.findall(
            r'(pastebin\.com|discord\.gg|bit\.ly|ngrok\.io|webhook\.site)',
            content,
            re.IGNORECASE
        )),
        'file_operations': len(re.findall(r'(open\(|fs\.(read|write)|readFile|writeFile)\s*\(', content)),
        'backdoor_patterns': len(re.findall(
            r'(nc\s+-l|reverse\s+shell|telnet|ssh.*-R|\$\(whoami\))',
            content,
            re.IGNORECASE
        )),
    }
    
    return patterns


def get_obfuscation_score(content: str) -> float:
    """Calculate obfuscation score (0.0-1.0)."""
    if not content:
        return 0.0
    
    # Check for minification indicators
    avg_line_length = sum(len(line) for line in content.split('\n')) / max(len(content.split('\n')), 1)
    has_many_long_lines = avg_line_length > 200
    
    # Check for variable name patterns
    import re
    single_letter_vars = len(re.findall(r'\b[a-z]\b', content))
    total_words = len(re.findall(r'\b\w+\b', content))
    
    hex_strings = len(re.findall(r'0x[0-9a-fA-F]+', content))
    
    score = 0.0
    if has_many_long_lines:
        score += 0.3
    if total_words > 0 and single_letter_vars / total_words > 0.1:
        score += 0.3
    if hex_strings > 10:
        score += 0.2
    
    # Minified code indicators
    if content.count('\n') < len(content) / 200:
        score += 0.2
    
    return min(score, 1.0)


def scan_directory_recursively(directory: Path, extensions: List[str]) -> Dict[str, Any]:
    """Recursively scan directory for patterns."""
    aggregated = {
        'base64_strings': 0,
        'eval_usage': 0,
        'exec_usage': 0,
        'shell_command_exec': 0,
        'env_var_access': 0,
        'fernet_usage': 0,
        'aes_usage': 0,
        'rsa_usage': 0,
        'network_calls': 0,
        'external_urls': 0,
        'suspicious_urls': 0,
        'file_operations': 0,
        'backdoor_patterns': 0,
        'obfuscation_score': 0.0,
        'files_scanned': 0,
    }
    
    for file_path in directory.rglob('*'):
        if not file_path.is_file():
            continue
        
        # Check extension
        if extensions and file_path.suffix not in extensions:
            continue
        
        # Skip binary/large files
        try:
            if file_path.stat().st_size > 1_000_000:
                continue
        except:
            continue
        
        content = read_file_safe(file_path)
        if not content or content.startswith('<FILE TOO LARGE'):
            continue
        
        patterns = scan_file_for_patterns(content)
        for key, val in patterns.items():
            if key in aggregated and isinstance(aggregated[key], int):
                aggregated[key] += val
        
        obf = get_obfuscation_score(content)
        aggregated['obfuscation_score'] = max(aggregated['obfuscation_score'], obf)
        aggregated['files_scanned'] += 1
    
    return aggregated


# ════════════════════════════════════════════════════════════════════════════════
# PACKAGE DETECTION & FEATURE EXTRACTION
# ════════════════════════════════════════════════════════════════════════════════

def detect_package_type(path: Path) -> str:
    """Detect if package is npm or pypi based on manifest files."""
    if (path / "package.json").exists():
        return "npm"
    if (path / "setup.py").exists() or (path / "pyproject.toml").exists():
        return "pypi"
    # Default based on common files
    if any(path.glob("**/*.js")):
        return "npm"
    if any(path.glob("**/*.py")):
        return "pypi"
    return "unknown"


def extract_npm_features(path: Path) -> Dict[str, Any]:
    """Extract npm package features."""
    features = {"ecosystem": "npm", "package_name": "unknown"}
    
    pkg_json_path = path / "package.json"
    if pkg_json_path.exists():
        try:
            with open(pkg_json_path) as f:
                pkg = json.load(f)
            features['package_name'] = pkg.get('name', 'unknown')
            features['version'] = pkg.get('version', '0.0.0')
            features['has_postinstall_hook'] = '1' if 'postinstall' in pkg.get('scripts', {}) else '0'
            features['has_preinstall_hook'] = '1' if 'preinstall' in pkg.get('scripts', {}) else '0'
        except:
            pass
    
    # Scan JS files
    js_extensions = ['.js', '.ts', '.jsx', '.tsx']
    patterns = scan_directory_recursively(path, js_extensions)
    features.update(patterns)
    
    return features


def extract_pypi_features(path: Path) -> Dict[str, Any]:
    """Extract PyPI package features."""
    features = {"ecosystem": "pypi", "package_name": "unknown"}
    
    setup_py = path / "setup.py"
    if setup_py.exists():
        try:
            content = read_file_safe(setup_py)
            import re
            match = re.search(r'name\s*=\s*["\']([^"\']+)["\']', content)
            if match:
                features['package_name'] = match.group(1)
        except:
            pass
    
    # Scan Python files
    py_extensions = ['.py']
    patterns = scan_directory_recursively(path, py_extensions)
    features.update(patterns)
    
    return features


def extract_features(package_path: str) -> Dict[str, Any]:
    """Extract features from a package path (directory, tar.gz, zip, etc)."""
    # Extract if needed
    extracted_path, was_extracted = extract_packed_package(package_path)
    
    try:
        # Detect package type
        pkg_type = detect_package_type(extracted_path)
        
        # Extract features based on type
        if pkg_type == "npm":
            features = extract_npm_features(extracted_path)
        elif pkg_type == "pypi":
            features = extract_pypi_features(extracted_path)
        else:
            # Try both
            features = extract_npm_features(extracted_path)
            if features.get('files_scanned', 0) == 0:
                features = extract_pypi_features(extracted_path)
        
        return features
    finally:
        # Clean up temp extraction if needed
        if was_extracted:
            import shutil
            try:
                shutil.rmtree(extracted_path)
            except:
                pass


# ════════════════════════════════════════════════════════════════════════════════
# ML PREDICTION
# ════════════════════════════════════════════════════════════════════════════════

def predict_risk(model_data: Dict, features: Dict[str, Any]) -> Tuple[str, float]:
    """Predict package risk level using trained model."""
    model = model_data['model']
    scaler = model_data['scaler']
    feature_cols = model_data.get('feature_cols') or model_data.get('feature_columns', [])
    
    # Build feature vector
    X = pd.DataFrame([{col: features.get(col, 0) for col in feature_cols}])
    X = X.fillna(0)
    
    # Scale and predict
    X_scaled = scaler.transform(X)
    proba = model.predict_proba(X_scaled)[0]
    malicious_prob = proba[1]
    
    # Classify
    if malicious_prob >= 0.65:
        label = "MALICIOUS"
    elif malicious_prob >= 0.35:
        label = "SUSPICIOUS"
    else:
        label = "SAFE"
    
    return label, malicious_prob


# ════════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════════

def analyze_package(package_path: str) -> Dict[str, Any]:
    """Main analysis function."""
    # Load model
    model_data = load_model()
    
    # Extract features
    features = extract_features(package_path)
    
    # Predict risk
    label, malicious_prob = predict_risk(model_data, features)
    
    # Build result
    result = {
        "package_name": features.get('package_name', 'unknown'),
        "ecosystem": features.get('ecosystem', 'unknown'),
        "version": features.get('version', 'unknown'),
        "label": label,
        "malicious_probability": float(malicious_prob),
        "confidence": float(max(malicious_prob, 1.0 - malicious_prob)),
        "features": {k: v for k, v in features.items() if k not in ['package_name', 'ecosystem', 'version']},
    }
    
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <package_path>")
        print(f"  <package_path> can be:")
        print(f"    - Directory (unpacked package)")
        print(f"    - .tar.gz or .tgz file")
        print(f"    - .zip file")
        sys.exit(1)
    
    package_path = sys.argv[1]
    result = analyze_package(package_path)
    print(json.dumps(result, indent=2))
