import re
import json
import pickle
import hashlib
import os
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import tempfile
import tarfile
import zipfile
import warnings
warnings.filterwarnings('ignore')

# Resolve paths relative to this script's directory
SCRIPT_DIR = Path(__file__).parent.resolve()
# Try multiple locations for the model file
MODEL_PATHS = [
    SCRIPT_DIR / "data" / "security_model.pkl",
    SCRIPT_DIR / "RandomForest" / "security_model.pkl",
    Path("data") / "security_model.pkl",
    Path("RandomForest") / "security_model.pkl",
]
MODEL_PATH = None
for path in MODEL_PATHS:
    if path.exists():
        MODEL_PATH = path
        break
if MODEL_PATH is None:
    # Default to data directory for training
    MODEL_PATH = SCRIPT_DIR / "data" / "security_model.pkl"

FEATURE_COLS_PATH = SCRIPT_DIR / "data" / "feature_cols.json"

# ---------------- Patterns ----------------
URL_RE = re.compile(r"https?://[^\s'\"<>]+", re.IGNORECASE)
SUSPICIOUS_URL_HINTS = ["pastebin", "bit.ly", "tinyurl", ".ru/", ".cn/", "raw.githubusercontent.com"]

BASE64_RE = re.compile(r"(?:[A-Za-z0-9+/]{24,}={0,2})")

NET_HINTS = [
    "http://", "https://", "fetch(", "axios", "requests.", "urllib", "socket",
    "net.connect", "http.request", "https.request"
]
ENV_HINTS = ["process.env", "os.environ"]
FS_READ_HINTS = ["readfile", "readfilesync", "open(", ".ssh", ".npmrc", ".pypirc", "id_rsa", "credentials"]
FS_WRITE_HINTS = ["writefile", "writefilesync", "chmod", "chown", "createwritestream"]
CRYPTO_HINTS = ["crypto", "cryptography", "cipher", "aes", "rsa", "pbkdf2", "hashlib"]

SHELL_HINTS = ["child_process.exec", "child_process.spawn", "powershell", "cmd.exe", "bash -i", "sh -c", "curl ", "wget ", "subprocess."]
REMOTE_DL_HINTS = ["curl ", "wget ", "invoke-webrequest", "downloadfile", "requests.get", "urllib.request", "http.get(", "https.get("]

EXFIL_HINTS = ["webhook", "telegram", "discord", "pastebin", "upload", "exfil", "requests.post", "axios.post", "fetch("]
KEYLOGGER_HINTS = ["keylogger", "pynput", "iohook", "getasynckeystate", "keyboard hook", "keypress"]
BACKDOOR_HINTS = ["reverse shell", "nc -e", "bash -i", "bind shell", "socket.connect", "listen(", "accept(", "powershell -enc"]

PY_IMPORT_RE = re.compile(r"^\s*(?:from\s+([a-zA-Z0-9_\.]+)\s+import|import\s+([a-zA-Z0-9_\.]+))")

# ════════════════════════════════════════════════════════════════════════════════
# PACKAGE EXTRACTION (for tar.gz, zip, etc.)
# ════════════════════════════════════════════════════════════════════════════════

def extract_tar_gz(tar_path: Path) -> Path:
    """Extract .tar.gz archive and return extraction directory."""
    extract_dir = Path(tempfile.mkdtemp(prefix="pkg_tar_"))
    try:
        with tarfile.open(tar_path, 'r:gz') as tar:
            tar.extractall(path=extract_dir)
        return extract_dir
    except Exception as e:
        return None


def extract_zip(zip_path: Path) -> Path:
    """Extract .zip archive and return extraction directory."""
    extract_dir = Path(tempfile.mkdtemp(prefix="pkg_zip_"))
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(path=extract_dir)
        return extract_dir
    except Exception as e:
        return None


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
        extracted = extract_tar_gz(path)
    else:
        # Assume it's a directory or try to handle it
        return path, False
    
    if extracted is None:
        raise RuntimeError(f"Failed to extract {package_path}")
    
    return extracted, True


# ════════════════════════════════════════════════════════════════════════════════
# SNAPSHOT CACHE
# ════════════════════════════════════════════════════════════════════════════════
CACHE_DIR = Path(".pkg_snapshots")
CACHE_DIR.mkdir(exist_ok=True)

TEXT_EXTS_NPM = {".js", ".mjs", ".cjs", ".ts", ".json", ".md", ".txt"}
TEXT_EXTS_PY = {".py", ".txt", ".md", ".json", ".cfg", ".ini", ".toml"}
TEXT_EXTS_PROJECT = {".py", ".js", ".mjs", ".cjs", ".ts", ".java", ".kt", ".gradle", ".kts", ".xml", ".json", ".yml", ".yaml", ".md", ".txt"}

def _hash_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest()

def _read_text_file(p: Path, max_bytes=200_000) -> str:
    try:
        data = p.read_bytes()[:max_bytes]
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return ""

def _collect_code_text(root: Path, exts: set, max_files=400) -> Tuple[str, int]:
    blobs = []
    loc = 0
    count = 0
    for p in root.rglob("*"):
        if count >= max_files:
            break
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue
        text = _read_text_file(p)
        if not text:
            continue
        blobs.append(text)
        loc += text.count("\n") + 1
        count += 1
    return "\n".join(blobs), loc

def _minified_indicator(code: str) -> int:
    longest = max((len(line) for line in code.splitlines()), default=0)
    return 1 if longest > 600 else 0

def _obfuscation_score(code: str, base64_hits: int) -> float:
    score = 0.05
    lower = code.lower()
    if "\\x" in code or "\\u" in code:
        score += 0.25
    if "atob(" in lower or "unescape(" in lower:
        score += 0.20
    if base64_hits >= 3:
        score += 0.20
    if base64_hits >= 10:
        score += 0.25
    return float(min(score, 0.98))

def _count_any(code_lower: str, hints: List[str]) -> int:
    return sum(code_lower.count(h.lower()) for h in hints)

def scan_code_features(code: str) -> Dict[str, float]:
    """Extract all 65 features matching the trained model"""
    lower = code.lower()

    urls = URL_RE.findall(code)
    external_urls_count = len(urls)
    suspicious_domains = sum(1 for u in urls if any(x in u.lower() for x in SUSPICIOUS_URL_HINTS))

    base64_hits = len(BASE64_RE.findall(code))
    hex_strings = len(re.findall(r'0x[0-9a-fA-F]{8,}', code))

    # Code execution
    eval_calls = lower.count("eval(")
    exec_calls = lower.count("exec(")
    subprocess_calls = lower.count("subprocess.") + lower.count("popen")
    os_system_calls = lower.count("os.system") + lower.count("system(")
    shell_commands = subprocess_calls + os_system_calls

    # Network operations
    http_requests = lower.count("http.request") + lower.count("requests.") + lower.count("axios.") + lower.count("fetch(")
    socket_usage = 1 if "socket" in lower else 0
    dns_lookups = lower.count("dns.") + lower.count("resolve(")
    ip_addresses_hardcoded = len(re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', code))

    # File operations
    file_read_ops = sum(lower.count(h) for h in ["open(", ".read(", "readfile", "fs.read"])
    file_write_ops = sum(lower.count(h) for h in ["write(", "writefile", "fs.write", ".dump("])
    file_delete_ops = lower.count("unlink") + lower.count("remove(") + lower.count("fs.rm")
    temp_file_usage = 1 if "temp" in lower or "tmp" in lower else 0
    sensitive_paths = sum(lower.count(p) for p in [".env", ".ssh", "id_rsa", "credentials", "password", ".aws"])

    # Environment & credentials
    env_var_access = sum(lower.count(h) for h in ["process.env", "os.environ", "getenv"])
    credential_patterns = sum(lower.count(p) for p in ["password", "passwd", "credential"])
    token_patterns = sum(lower.count(p) for p in ["token", "bearer", "jwt"])
    password_patterns = sum(lower.count(p) for p in ["password=", "pwd=", "pass="])
    api_key_patterns = sum(lower.count(p) for p in ["api_key", "apikey", "api-key"])

    # Encryption & encoding
    base64_imports = lower.count("base64") + lower.count("atob") + lower.count("btoa")
    base64_decode_calls = lower.count("decode(") + lower.count("atob(")
    fernet_usage = 1 if "fernet" in lower else 0
    aes_usage = 1 if "aes" in lower else 0
    rsa_usage = 1 if "rsa" in lower else 0
    crypto_imports = lower.count("crypto") + lower.count("cipher")

    # Obfuscation
    minified_code = _minified_indicator(code)
    obfuscation_score = _obfuscation_score(code, base64_hits)
    unicode_obfuscation = 1 if re.search(r'\\u[0-9a-fA-F]{4}', code) else 0
    string_concat_abuse = code.count(" + ") if code.count(" + ") > 20 else 0

    # Malicious patterns
    keylogger_patterns = 1 if any(h in lower for h in ["keylog", "keystroke", "keypress"]) else 0
    screenshot_capture = 1 if any(h in lower for h in ["screenshot", "screen.capture"]) else 0
    clipboard_access = 1 if "clipboard" in lower else 0
    webcam_access = 1 if "webcam" in lower or "video" in lower else 0
    microphone_access = 1 if "microphone" in lower or "audio.record" in lower else 0
    reverse_shell = 1 if any(h in lower for h in ["reverse shell", "/bin/sh", "/bin/bash -i"]) else 0
    backdoor_patterns = 1 if any(h in lower for h in ["backdoor", "reverse_tcp", "meterpreter"]) else 0
    c2_server = 1 if any(h in lower for h in ["c2", "command and control", "beacon"]) else 0

    # System modification
    startup_modification = 1 if any(h in lower for h in ["autostart", "startup", "init.d"]) else 0
    cron_job_creation = 1 if "cron" in lower else 0
    registry_modification = 1 if "registry" in lower or "regedit" in lower else 0

    return {
        # Base64 & Encoding
        "base64_imports": min(base64_imports, 10),
        "base64_decode_calls": min(base64_decode_calls, 20),
        "base64_encoded_strings": min(base64_hits, 20),
        
        # Encryption
        "fernet_usage": fernet_usage,
        "aes_usage": aes_usage,
        "rsa_usage": rsa_usage,
        "crypto_imports": min(crypto_imports, 10),
        
        # Network
        "http_requests": min(http_requests, 30),
        "socket_usage": socket_usage,
        "dns_lookups": min(dns_lookups, 10),
        "external_urls_count": min(external_urls_count, 20),
        "ip_addresses_hardcoded": min(ip_addresses_hardcoded, 10),
        "suspicious_domains": min(suspicious_domains, 10),
        
        # File operations
        "file_read_operations": min(file_read_ops, 50),
        "file_write_operations": min(file_write_ops, 50),
        "file_delete_operations": min(file_delete_ops, 20),
        "temp_file_usage": temp_file_usage,
        "sensitive_paths_accessed": min(sensitive_paths, 10),
        
        # Code execution
        "eval_calls": min(eval_calls, 20),
        "exec_calls": min(exec_calls, 20),
        "subprocess_calls": min(subprocess_calls, 20),
        "os_system_calls": min(os_system_calls, 20),
        "shell_commands": min(shell_commands, 20),
        
        # Obfuscation
        "obfuscation_score": float(obfuscation_score),
        "minified_code": minified_code,
        "hex_encoded_strings": min(hex_strings, 20),
        "unicode_obfuscation": unicode_obfuscation,
        "string_concatenation_abuse": min(string_concat_abuse, 50),
        
        # Environment & credentials
        "env_var_access": min(env_var_access, 10),
        "credential_patterns": min(credential_patterns, 20),
        "token_patterns": min(token_patterns, 20),
        "password_patterns": min(password_patterns, 20),
        "api_key_patterns": min(api_key_patterns, 20),
        
        # Malicious behaviors
        "keylogger_patterns": keylogger_patterns,
        "screenshot_capture": screenshot_capture,
        "clipboard_access": clipboard_access,
        "webcam_access": webcam_access,
        "microphone_access": microphone_access,
        "reverse_shell_patterns": reverse_shell,
        "backdoor_patterns": backdoor_patterns,
        "c2_server_patterns": c2_server,
        
        # System modification
        "startup_modification": startup_modification,
        "cron_job_creation": cron_job_creation,
        "registry_modification": registry_modification,
    }

def snapshot_and_diff(pkg_key: str, loc_now: int, code_text: str) -> Dict[str, float]:
    snap_path = CACHE_DIR / f"{pkg_key}.json"
    cur_hash = _hash_text(code_text[:500000])
    cur_loc = int(loc_now)

    added = 0
    removed = 0
    ratio = 0.0

    if snap_path.exists():
        try:
            prev = json.loads(snap_path.read_text(encoding="utf-8"))
            prev_loc = int(prev.get("loc", 0))
            prev_hash = prev.get("hash", "")
            if prev_hash and prev_hash != cur_hash:
                delta = cur_loc - prev_loc
                if delta >= 0:
                    added = delta
                else:
                    removed = abs(delta)
                denom = max(cur_loc + prev_loc, 1)
                ratio = float((added + removed) / denom)
        except Exception:
            pass

    try:
        snap_path.write_text(json.dumps({"hash": cur_hash, "loc": cur_loc}), encoding="utf-8")
    except Exception:
        pass

    return {
        "code_lines_added": int(added),
        "code_lines_removed": int(removed),
        "code_change_ratio": float(round(ratio, 4)),
    }

# ---------------- Dependency parsing (fallbacks) ----------------
def parse_package_json_deps(project_dir: Path) -> List[str]:
    pj = project_dir / "package.json"
    if not pj.exists():
        return []
    try:
        data = json.loads(pj.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return []
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    return sorted({k.lower() for k in deps.keys()})

def parse_requirements_txt(project_dir: Path) -> List[str]:
    req = project_dir / "requirements.txt"
    if not req.exists():
        return []
    pkgs = set()
    for line in req.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name = re.split(r"[<>=!~]", line, maxsplit=1)[0].strip()
        if name:
            pkgs.add(name.lower())
    return sorted(pkgs)

def scan_python_imports(project_dir: Path, max_files=400) -> List[str]:
    found = set()
    stdlib = {
        "os","sys","re","json","math","time","pathlib","typing","logging","random",
        "itertools","collections","subprocess","threading","asyncio","datetime"
    }
    count = 0

    for p in project_dir.rglob("*.py"):
        if count >= max_files:
            break
        count += 1
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for line in text.splitlines():
            m = PY_IMPORT_RE.match(line)
            if not m:
                continue
            mod = (m.group(1) or m.group(2) or "").strip()
            if not mod:
                continue
            base = mod.split(".")[0].lower()
            if base in stdlib:
                continue
            found.add(base)

    return sorted(found)

# ---------------- npm scanning (deep if node_modules exists) ----------------
def list_npm_installed(project_dir: Path) -> List[Tuple[str, Path]]:
    node_modules = project_dir / "node_modules"
    if not node_modules.exists():
        return []
    pkgs = []
    for p in node_modules.iterdir():
        if not p.is_dir():
            continue
        if p.name.startswith("."):
            continue
        if p.name.startswith("@"):
            for sp in p.iterdir():
                if sp.is_dir():
                    pkgs.append((f"{p.name}/{sp.name}".lower(), sp))
        else:
            pkgs.append((p.name.lower(), p))
    return pkgs

def npm_pkg_meta(pkg_dir: Path) -> Dict:
    pj = pkg_dir / "package.json"
    if not pj.exists():
        return {}
    try:
        return json.loads(pj.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return {}

# ---------------- python scanning (deep if venv exists) ----------------
def find_site_packages(project_dir: Path) -> List[Path]:
    candidates = []
    for venv_name in ["venv", ".venv", "env", ".env"]:
        venv = project_dir / venv_name
        if not venv.exists():
            continue
        candidates.append(venv / "Lib" / "site-packages")                # Windows
        candidates.extend(list((venv / "lib").glob("python*/site-packages")))  # Linux/Mac
    return [p for p in candidates if p.exists()]

def list_pypi_installed(project_dir: Path) -> List[Tuple[str, Path]]:
    sites = find_site_packages(project_dir)
    if not sites:
        return []

    pkgs = []
    for site in sites:
        for p in site.iterdir():
            if not p.is_dir():
                continue
            name = p.name
            if name.endswith(".dist-info") or name.endswith(".egg-info"):
                continue
            if name.startswith("_"):
                continue
            pkgs.append((name.lower(), p))

    seen = set()
    out = []
    for n, d in pkgs:
        if n not in seen:
            seen.add(n)
            out.append((n, d))
    return out

# ---------------- feature row ----------------
def base_row(package_name: str, ecosystem: str) -> Dict[str, float]:
    """Initialize row with all 65 features matching trained model"""
    return {
        "package_name": package_name,
        "ecosystem": ecosystem,
        
        # Package metadata (8 features)
        "downloads_count": 0,
        "age_days": 0,
        "maintainers_count": 1,
        "dependencies_count": 0,
        "version_major": 0,
        "version_minor": 0,
        "version_patch": 0,
        "is_prerelease": 0,
        
        # Base64 & Encoding (3 features)
        "base64_imports": 0,
        "base64_decode_calls": 0,
        "base64_encoded_strings": 0,
        
        # Encryption (4 features)
        "fernet_usage": 0,
        "aes_usage": 0,
        "rsa_usage": 0,
        "crypto_imports": 0,
        
        # Network (6 features)
        "http_requests": 0,
        "socket_usage": 0,
        "dns_lookups": 0,
        "external_urls_count": 0,
        "ip_addresses_hardcoded": 0,
        "suspicious_domains": 0,
        
        # File operations (5 features)
        "file_read_operations": 0,
        "file_write_operations": 0,
        "file_delete_operations": 0,
        "temp_file_usage": 0,
        "sensitive_paths_accessed": 0,
        
        # Code execution (5 features)
        "eval_calls": 0,
        "exec_calls": 0,
        "subprocess_calls": 0,
        "os_system_calls": 0,
        "shell_commands": 0,
        
        # Obfuscation (5 features)
        "obfuscation_score": 0.0,
        "minified_code": 0,
        "hex_encoded_strings": 0,
        "unicode_obfuscation": 0,
        "string_concatenation_abuse": 0,
        
        # Environment & credentials (5 features)
        "env_var_access": 0,
        "credential_patterns": 0,
        "token_patterns": 0,
        "password_patterns": 0,
        "api_key_patterns": 0,
        
        # Malicious behaviors (8 features)
        "keylogger_patterns": 0,
        "screenshot_capture": 0,
        "clipboard_access": 0,
        "webcam_access": 0,
        "microphone_access": 0,
        "reverse_shell_patterns": 0,
        "backdoor_patterns": 0,
        "c2_server_patterns": 0,
        
        # System modification (3 features)
        "startup_modification": 0,
        "cron_job_creation": 0,
        "registry_modification": 0,
        
        # Documentation (5 features)
        "has_readme": 0,
        "has_license": 0,
        "has_tests": 0,
        "has_changelog": 0,
        "documentation_score": 0.0,
        
        # Author info (4 features)
        "author_account_age_days": 0,
        "author_other_packages": 0,
        "author_verified": 0,
        "author_email_disposable": 0,
        
        # Security (4 features)
        "typosquatting_score": 0.0,
        "name_similarity_to_popular": 0.0,
        "known_vulnerability_count": 0,
        "cve_references": 0,
        
        # helper: whether we had deep package code available
        "scan_depth": "declared",
    }

def build_npm_row(name: str, pkg_dir: Path) -> Dict[str, float]:
    row = base_row(name, "npm")
    row["scan_depth"] = "installed"

    meta = npm_pkg_meta(pkg_dir)

    # Extract version
    version = meta.get("version", "0.0.0")
    version_parts = version.split(".")
    if len(version_parts) >= 3:
        row["version_major"] = int(version_parts[0]) if version_parts[0].isdigit() else 0
        row["version_minor"] = int(version_parts[1]) if version_parts[1].isdigit() else 0
        row["version_patch"] = int(version_parts[2].split("-")[0]) if version_parts[2].split("-")[0].isdigit() else 0
        row["is_prerelease"] = 1 if "-" in version or "beta" in version.lower() or "alpha" in version.lower() else 0

    # Maintainers
    maintainers = meta.get("maintainers")
    if isinstance(maintainers, list):
        row["maintainers_count"] = len(maintainers)

    # Dependencies
    deps = meta.get("dependencies", {}) or {}
    row["dependencies_count"] = int(len(deps))

    # Check for README, license, tests
    row["has_readme"] = 1 if (pkg_dir / "README.md").exists() or (pkg_dir / "readme.md").exists() else 0
    row["has_license"] = 1 if (pkg_dir / "LICENSE").exists() or (pkg_dir / "LICENSE.md").exists() else 0
    row["has_tests"] = 1 if (pkg_dir / "test").exists() or (pkg_dir / "tests").exists() or (pkg_dir / "__tests__").exists() else 0
    row["has_changelog"] = 1 if (pkg_dir / "CHANGELOG.md").exists() or (pkg_dir / "CHANGELOG").exists() else 0
    row["documentation_score"] = (row["has_readme"] + row["has_license"] + row["has_tests"]) / 3.0

    # Scan code
    code_text, loc = _collect_code_text(pkg_dir, TEXT_EXTS_NPM)
    if code_text:
        row.update(scan_code_features(code_text))

    return row

def build_pypi_row(name: str, pkg_dir: Path) -> Dict[str, float]:
    row = base_row(name, "pypi")
    row["scan_depth"] = "installed"

    # try parse metadata from dist-info if exists
    site = pkg_dir.parent
    dist_infos = list(site.glob(f"{name.replace('-', '_')}*.dist-info"))
    if dist_infos:
        meta_file = dist_infos[0] / "METADATA"
        if meta_file.exists():
            txt = _read_text_file(meta_file)
            row["dependencies_count"] = int(sum(1 for line in txt.splitlines() if line.lower().startswith("requires-dist:")))
            
            # Extract version from metadata
            for line in txt.splitlines():
                if line.startswith("Version:"):
                    version = line.split(":", 1)[1].strip()
                    version_parts = version.split(".")
                    if len(version_parts) >= 3:
                        row["version_major"] = int(version_parts[0]) if version_parts[0].isdigit() else 0
                        row["version_minor"] = int(version_parts[1]) if version_parts[1].isdigit() else 0
                        row["version_patch"] = int(version_parts[2].split("-")[0]) if version_parts[2].split("-")[0].isdigit() else 0
                    break

    # Check for documentation files
    row["has_readme"] = 1 if (pkg_dir / "README.md").exists() or (pkg_dir / "README.rst").exists() else 0
    row["has_license"] = 1 if (pkg_dir / "LICENSE").exists() or (pkg_dir / "LICENSE.txt").exists() else 0
    row["has_tests"] = 1 if (pkg_dir / "tests").exists() or (pkg_dir / "test").exists() else 0
    row["has_changelog"] = 1 if (pkg_dir / "CHANGELOG.md").exists() or (pkg_dir / "CHANGES.txt").exists() else 0
    row["documentation_score"] = (row["has_readme"] + row["has_license"] + row["has_tests"]) / 3.0

    # Scan code
    code_text, loc = _collect_code_text(pkg_dir, TEXT_EXTS_PY)
    if code_text:
        row.update(scan_code_features(code_text))

    return row

# ---------------- project-level scan (works on any upload) ----------------
def scan_project_source_for_risks(project_dir: Path) -> Dict[str, float]:
    code_text, _ = _collect_code_text(project_dir, TEXT_EXTS_PROJECT, max_files=500)
    if not code_text:
        return {}
    return scan_code_features(code_text)

# ---------------- prediction ----------------
def load_model():
    # Check if model exists, if not provide a helpful error
    if not Path(MODEL_PATH).exists():
        error_msg = f"Model file not found at: {MODEL_PATH}\n"
        error_msg += "Searched locations:\n"
        for path in MODEL_PATHS:
            error_msg += f"  - {path} {'(exists)' if path.exists() else '(not found)'}\n"
        error_msg += "\nPlease run train_model.py to generate the model or copy it to data/ or RandomForest/ directory."
        raise FileNotFoundError(error_msg)
    
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)

def encode_ecosystem(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["eco_is_npm"] = (df["ecosystem"].astype(str).str.lower() == "npm").astype(int)
    df["eco_is_pypi"] = (df["ecosystem"].astype(str).str.lower() == "pypi").astype(int)
    return df

def explain_row_binary_first(row_dict: Dict, explanations: Dict[str, str], top_k=5) -> List[str]:
    priority = [
        "has_postinstall_hook",
        "remote_code_download",
        "shell_command_exec",
        "data_exfiltration_patterns",
        "keylogger_patterns",
        "backdoor_patterns",
        "suspicious_urls",
        "env_var_access",
        "eval_usage",
        "exec_usage",
        "base64_encoding",
        "minified_code",
        "obfuscation_score",
        "external_urls_count",
    ]

    reasons = []
    for f in priority:
        v = row_dict.get(f, 0)
        if isinstance(v, (int, float)) and v:
            if f in explanations:
                reasons.append(explanations[f])
        if len(reasons) >= top_k:
            break
    return reasons[:top_k]

def predict_rows(rows: List[Dict], threshold_safe=0.25, threshold_mal=0.50) -> List[Dict]:
    art = load_model()
    model = art["model"]
    scaler = art["scaler"]
    feature_cols = art.get("feature_cols") or art.get("feature_columns", [])
    explanations = art.get("feature_explanations", {})

    if not rows:
        return []

    df = pd.DataFrame(rows)
    df = encode_ecosystem(df)

    X = pd.DataFrame(
        [{c: r.get(c, 0) for c in feature_cols} for r in df.to_dict(orient="records")],
        columns=feature_cols
    ).fillna(0)

    Xs = scaler.transform(X)
    proba = model.predict_proba(Xs)[:, 1]

    out = []
    recs = df.to_dict(orient="records")
    for r, p in zip(recs, proba):
        p = float(p)

        if p >= threshold_mal:
            label = "MALICIOUS"
        elif p <= threshold_safe:
            label = "SAFE"
        else:
            label = "SUSPICIOUS"

        reasons = explain_row_binary_first(r, explanations, top_k=5)

        out.append({
            "package_name": r.get("package_name"),
            "ecosystem": r.get("ecosystem"),
            "scan_depth": r.get("scan_depth", "declared"),
            "label": label,
            "malicious_probability": p,
            "confidence": max(p, 1 - p),
            "top_reasons": reasons,
            "features": {k: r.get(k) for k in [
                "dependency_count",
                "maintainer_changes",
                "code_lines_added", "code_lines_removed", "code_change_ratio",
                "has_install_scripts", "has_postinstall_hook",
                "external_urls_count", "suspicious_urls",
                "env_var_access",
                "eval_usage", "exec_usage", "base64_encoding",
                "shell_command_exec", "remote_code_download",
                "data_exfiltration_patterns", "keylogger_patterns", "backdoor_patterns",
                "minified_code", "obfuscation_score",
            ] if k in r}
        })

    out.sort(key=lambda x: x["malicious_probability"], reverse=True)
    return out

# ---------------- main scan pipeline ----------------
def scan_project(project_dir: str) -> Tuple[List[Dict], Dict[str, float]]:
    project = Path(project_dir)
    rows: List[Dict] = []

    # Check if this is a standalone PACKAGE (has manifest but no node_modules/site-packages)
    has_pkg_json = (project / "package.json").exists()
    has_setup_py = (project / "setup.py").exists()
    has_node_modules = (project / "node_modules").exists()
    has_site_packages = (project / "site-packages").exists() or (project / "lib").exists()
    
    is_standalone_package = (has_pkg_json or has_setup_py) and not (has_node_modules or has_site_packages)
    
    # If it's a standalone package (source-only, no dependencies), analyze it directly
    if is_standalone_package:
        # Determine package name and ecosystem
        pkg_name = 'unknown'
        ecosystem = 'unknown'
        
        if has_pkg_json:
            ecosystem = 'npm'
            try:
                meta = json.loads((project / "package.json").read_text(encoding="utf-8"))
                pkg_name = meta.get('name', project.name)
            except:
                pkg_name = project.name
        elif has_setup_py:
            ecosystem = 'pypi'
            pkg_name = project.name
        
        # Create base row with all 65 features
        row = base_row(pkg_name, ecosystem)
        row['scan_depth'] = 'source'
        
        # Extract code features using scan_code_features
        code_features = scan_project_source_for_risks(project)
        row.update(code_features)
        
        rows.append(row)
    
    # If not a standalone package, scan for installed dependencies (original logic)
    if not rows:
        # Deep scan installed npm
        npm_installed = list_npm_installed(project)
        for name, pkg_dir in npm_installed:
            rows.append(build_npm_row(name, pkg_dir))

        # Fallback npm declared deps
        if not npm_installed:
            for name in parse_package_json_deps(project):
                rows.append(base_row(name, "npm"))

        # Deep scan installed pypi
        pypi_installed = list_pypi_installed(project)
        for name, pkg_dir in pypi_installed:
            rows.append(build_pypi_row(name, pkg_dir))

        # Fallback pypi requirements/imports
        if not pypi_installed:
            reqs = parse_requirements_txt(project)
            if reqs:
                for name in reqs:
                    rows.append(base_row(name, "pypi"))
            else:
                imports = scan_python_imports(project)
                for name in imports:
                    rows.append(base_row(name, "pypi"))

    # Project-wide scan (works for ANY upload)
    project_risks = scan_project_source_for_risks(project)
    return rows, project_risks

def scan_and_predict(project_dir: str) -> Dict:
    # Try to extract if it's a packed package
    try:
        extracted_path, was_extracted = extract_packed_package(project_dir)
        project_to_scan = extracted_path
    except Exception as e:
        # Fall back to original path if extraction fails
        project_to_scan = Path(project_dir)
        was_extracted = False
    
    try:
        rows, project_risks = scan_project(str(project_to_scan))

        # If we only had declared deps, apply project-level risk signals to them
        # (so ML gets some non-zero signals even when packages aren't installed)
        if project_risks:
            for r in rows:
                if r.get("scan_depth") == "declared":
                    for k, v in project_risks.items():
                        # only fill if currently 0
                        if k in r and (r[k] == 0 or r[k] == 0.0):
                            r[k] = v

        results = predict_rows(rows)

        summary = {
            "SAFE": sum(1 for r in results if r["label"] == "SAFE"),
            "SUSPICIOUS": sum(1 for r in results if r["label"] == "SUSPICIOUS"),
            "MALICIOUS": sum(1 for r in results if r["label"] == "MALICIOUS"),
        }

        return {
            "project_dir": str(project_dir),
            "packages_scanned": len(results),
            "summary": summary,
            "project_risk_signals": project_risks,
            "results": results
        }
    finally:
        # Clean up temp extraction if needed
        if was_extracted:
            import shutil
            try:
                shutil.rmtree(project_to_scan)
            except:
                pass

if __name__ == "__main__":
    import sys
    proj = sys.argv[1] if len(sys.argv) > 1 else "."
    print(json.dumps(scan_and_predict(proj), indent=2))
