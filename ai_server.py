#!/usr/bin/env python3
"""
Python AI Server for Supply Chain Guardian
Provides REST API for package analysis using ML model and feature extraction
"""

import json
import os
import sys
import pickle
import warnings
from pathlib import Path
from typing import Dict, Any, List, Tuple
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

warnings.filterwarnings('ignore')

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# ════════════════════════════════════════════════════════════════════════════════
# MODEL AND SCALER LOADING
# ════════════════════════════════════════════════════════════════════════════════

def load_security_model():
    """Load pre-trained security model and scaler."""
    model_paths = [
        Path(__file__).parent / "security_model.pkl",
        Path(__file__).parent / "RandomForest" / "security_model.pkl",
    ]
    
    for path in model_paths:
        if path.exists():
            try:
                with open(path, 'rb') as f:
                    model_data = pickle.load(f)
                print(f"✅ Model loaded from: {path}")
                return model_data
            except Exception as e:
                print(f"⚠️  Failed to load from {path}: {e}", file=sys.stderr)
    
    print("❌ Could not find security_model.pkl", file=sys.stderr)
    raise FileNotFoundError("security_model.pkl not found")

# Load model at startup
try:
    MODEL_DATA = load_security_model()
    MODEL = MODEL_DATA.get('model')
    SCALER = MODEL_DATA.get('scaler')
    FEATURE_COLS = MODEL_DATA.get('feature_columns', [])
    METRICS = MODEL_DATA.get('metrics', {})
    print(f"📊 Model Accuracy: {METRICS.get('accuracy', 0):.1%}")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    MODEL = None
    SCALER = None

# ════════════════════════════════════════════════════════════════════════════════
# FEATURE EXTRACTION AND ANALYSIS
# ════════════════════════════════════════════════════════════════════════════════

def extract_basic_features(package_data: Dict[str, Any]) -> Dict[str, float]:
    """Extract basic features from package metadata."""
    
    # Get project context if available
    project_context = package_data.get('projectContext', {})
    
    # Parse version components
    version_str = package_data.get('version', '0.0.0')
    version_parts = [int(x) for x in version_str.split('.')[:3] if x.isdigit()] + [0, 0, 0]
    
    features = {
        'downloads_count': float(package_data.get('downloads', 500)),
        'age_days': float(package_data.get('age_days', 100)),
        'maintainers_count': float(package_data.get('maintainers', 1)),
        'dependencies_count': float(project_context.get('totalDeps', 0) + project_context.get('totalDevDeps', 0)),
        'version_major': float(version_parts[0]),
        'version_minor': float(version_parts[1]),
        'version_patch': float(version_parts[2]),
        'is_prerelease': float(1 if 'alpha' in version_str or 'beta' in version_str else 0),
        'has_readme': float(1 if package_data.get('has_readme', True) else 0),
        'has_license': float(1 if package_data.get('has_license', True) else 0),
        'has_tests': float(package_data.get('has_tests', 0)),
        'has_changelog': float(package_data.get('has_changelog', 0)),
        'author_account_age_days': float(package_data.get('author_age', 365)),
        'author_verified': float(package_data.get('author_verified', 0)),
        'typosquatting_score': float(package_data.get('typosquatting_score', 0)),
        'documented_cves': float(package_data.get('vulnerabilities', 0)),
        'has_install_scripts': float(1 if package_data.get('install_script') else 0),
        'suspicious_network_calls': float(package_data.get('network_calls', 0)),
        'eval_usage': float(package_data.get('eval', 0)),
        'obfuscation_score': float(package_data.get('obfuscation', 0) / 100.0),
        'is_dev_dependency': float(1 if package_data.get('isDev', False) else 0),
    }
    
    return features

def analyze_code_content(code_content: str) -> Dict[str, int]:
    """Analyze code content for suspicious patterns."""
    patterns = {
        'network_calls': 0,
        'file_operations': 0,
        'eval_usage': 0,
        'obfuscation': 0,
        'env_access': 0,
    }
    
    if not code_content:
        return patterns
    
    # Network patterns
    network_keywords = ['requests.', 'urllib', 'socket.', 'http.', 'fetch(', 'axios', 'got.']
    patterns['network_calls'] = sum(code_content.count(kw) for kw in network_keywords)
    
    # File operations
    file_keywords = ['open(', '.write', '.read(', 'os.remove', 'fs.']
    patterns['file_operations'] = sum(code_content.count(kw) for kw in file_keywords)
    
    # Dangerous functions
    dangerous_keywords = ['eval(', 'exec(', '__import__', 'subprocess']
    patterns['eval_usage'] = sum(code_content.count(kw) for kw in dangerous_keywords)
    
    # Environment access
    env_keywords = ['os.environ', 'process.env', 'getenv']
    patterns['env_access'] = sum(code_content.count(kw) for kw in env_keywords)
    
    # Obfuscation indicators (hex strings, base64, minified)
    hex_count = code_content.count('\\x') + code_content.count('0x')
    b64_count = code_content.count('base64') + code_content.count('btoa(') + code_content.count('atob(')
    minified = 1 if len(code_content) > 10000 and code_content.count('\n') < 100 else 0
    patterns['obfuscation'] = min(100, hex_count * 5 + b64_count * 3 + minified * 20)
    
    return patterns

def predict_risk(features: List[float]) -> Tuple[str, float, float]:
    """Predict risk using ML model."""
    if MODEL is None or SCALER is None:
        # Fallback if model not loaded
        return 'unknown', 0.5, 0.5
    
    try:
        # Scale features
        features_scaled = SCALER.transform([features])
        
        # Predict
        prediction = MODEL.predict(features_scaled)[0]
        probabilities = MODEL.predict_proba(features_scaled)[0]
        
        # Get class labels (assuming 0=safe, 1=malicious)
        malicious_prob = probabilities[1] if len(probabilities) > 1 else probabilities[0]
        safe_prob = probabilities[0] if len(probabilities) > 1 else 1 - malicious_prob
        
        label = 'malicious' if prediction == 1 else 'safe'
        
        return label, float(malicious_prob), float(safe_prob)
    except Exception as e:
        print(f"Prediction error: {e}", file=sys.stderr)
        return 'unknown', 0.5, 0.5

from typing import Optional

def calculate_risk_score(label: str, malicious_prob: float, code_patterns: Dict[str, int], features: Optional[Dict[str, float]] = None) -> Tuple[int, str, List[str]]:
    """Calculate comprehensive risk score (0-100) based on multiple factors."""
    
    issues = []
    score = 0
    
    # 1. ML Model prediction (0-35 points)
    ml_score = int(malicious_prob * 35)
    score += ml_score
    if malicious_prob > 0.7:
        issues.append(f"High ML model risk prediction ({malicious_prob:.0%})")
    
    # 2. Suspicious name patterns (0-25 points)
    if code_patterns.get('suspicious_name_pattern', 0) > 0:
        name_risk = min(25, code_patterns['suspicious_name_pattern'] * 15)
        score += name_risk
        issues.append(f"Package name contains suspicious keywords")
    
    # 3. Code patterns analysis (0-20 points)
    network_risk = min(10, code_patterns.get('network_calls', 0) * 5)
    score += network_risk
    if code_patterns.get('network_calls', 0) > 0:
        issues.append(f"Network activity detected ({code_patterns['network_calls']} calls)")
    
    file_risk = min(10, code_patterns.get('file_operations', 0) * 4)
    score += file_risk
    if code_patterns.get('file_operations', 0) > 0:
        issues.append(f"File operations detected ({code_patterns['file_operations']})")
    
    eval_risk = min(15, code_patterns.get('eval_usage', 0) * 8)
    score += eval_risk
    if code_patterns.get('eval_usage', 0) > 0:
        issues.append(f"Dangerous functions detected (eval/exec)")
    
    obfus_score = min(10, code_patterns.get('obfuscation', 0) // 15)
    score += obfus_score
    if code_patterns.get('obfuscation', 0) > 30:
        issues.append(f"Code obfuscation detected")
    
    # 4. Package metadata analysis (0-20 points)
    if features:
        # Very new package (less than 30 days old)
        if features.get('age_days', 0) < 30:
            score += 5
            issues.append("Very new package (< 30 days old)")
        
        # Very few maintainers
        if features.get('maintainers_count', 0) < 2:
            score += 3
            issues.append("Package has only one maintainer")
        
        # Very low downloads  
        if features.get('downloads_count', 500) < 100:
            score += 4
            issues.append("Very low download count (untrusted)")
        
        # No readme
        if features.get('has_readme', 1) == 0:
            score += 2
            issues.append("No README documentation")
        
        # Pre-release version
        if features.get('is_prerelease', 0) > 0:
            score += 2
            issues.append("Pre-release version")
        
        # Dev dependency (slightly lower risk)
        if features.get('is_dev_dependency', 0) > 0:
            score = int(score * 0.9)  # Reduce score by 10% for dev deps
    
    # Ensure score is between 0-100
    total_score = min(100, max(0, score))
    
    # Determine risk level
    if total_score >= 70:
        risk_level = 'critical'
    elif total_score >= 50:
        risk_level = 'high'
    elif total_score >= 30:
        risk_level = 'medium'
    else:
        risk_level = 'low'
    
    return total_score, risk_level, issues

# ════════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'model_loaded': MODEL is not None,
        'model_accuracy': METRICS.get('accuracy', 0),
    }), 200

@app.route('/analyze', methods=['POST'])
def analyze_packages():
    """Analyze packages for security risks."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Parse input - now expects 'packages' instead of 'formatted'
        packages = data.get('packages', data.get('formatted', []))
        
        if not packages:
            return jsonify({'error': 'No packages to analyze'}), 400
        
        # Analyze each package
        results = []
        for package in packages:
            pkg_name = package.get('name', 'unknown')
            pkg_version = package.get('version', 'unknown')
            is_dev = package.get('isDev', False)
            ecosystem = package.get('ecosystem', 'npm')
            
            # Extract features from package
            features_dict = extract_basic_features(package)
            
            # Add package-specific context
            features_dict['is_dev_dependency'] = float(is_dev)
            project_context = package.get('projectContext', {})
            if project_context:
                features_dict['dependencies_count'] = float(
                    project_context.get('totalDeps', 0) + project_context.get('totalDevDeps', 0)
                )
            
            # Analyze patterns based on package characteristics
            # For now, use basic pattern detection
            code_patterns = {}
            
            # Simulate pattern analysis based on package name/ecosystem
            # (In production, would analyze actual package source code)
            suspicious_keywords = ['crypto', 'bitcoin', 'wallet', 'steal', 'exploit', 'backdoor']
            pattern_score = 0
            for keyword in suspicious_keywords:
                if keyword.lower() in pkg_name.lower():
                    pattern_score += 1
            
            if pattern_score > 0:
                code_patterns['suspicious_name_pattern'] = pattern_score
            
            # Build feature vector for ML model
            feature_vector = []
            for col in FEATURE_COLS:
                feature_vector.append(features_dict.get(col, 0.0))
            
            # Predict risk
            label, malicious_prob, safe_prob = predict_risk(feature_vector) if feature_vector else ('unknown', 0.5, 0.5)
            
            # Calculate comprehensive risk score with features
            risk_score, risk_level, issues = calculate_risk_score(label, malicious_prob, code_patterns, features_dict)
            
            results.append({
                'package': pkg_name,
                'version': pkg_version,
                'isDev': is_dev,
                'ecosystem': ecosystem,
                'riskScore': risk_score,
                'riskLevel': risk_level,
                'issues': issues,
                'mlPrediction': label,
                'mlConfidence': malicious_prob,
                'patterns': code_patterns,
            })
        
        return jsonify({
            'success': True,
            'results': results,
            'model_info': {
                'accuracy': METRICS.get('accuracy', 0),
                'precision': METRICS.get('precision', 0),
            }
        }), 200
    
    except Exception as e:
        print(f"Error in /analyze: {str(e)}", file=sys.stderr)
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get server status."""
    return jsonify({
        'status': 'running',
        'model_loaded': MODEL is not None,
        'features_count': len(FEATURE_COLS),
        'model_metrics': METRICS,
    }), 200

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors."""
    return jsonify({'error': 'Internal server error'}), 500

# ════════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    port = int(os.getenv('PYTHON_AI_SERVER_PORT', 8000))
    debug = os.getenv('DEBUG', 'false').lower() == 'true'
    
    print("\n" + "="*60)
    print("🤖 SUPPLY CHAIN GUARDIAN - AI SERVER")
    print("="*60)
    print(f"Starting Flask server on port {port}...")
    print(f"API: http://localhost:{port}/analyze")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
