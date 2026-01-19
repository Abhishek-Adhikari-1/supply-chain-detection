import re
import json
import pickle
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

MODEL_PATH = "malicious_package_detector.pkl"

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

# ---------------- Snapshot cache ----------------
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
    lower = code.lower()

    urls = URL_RE.findall(code)
    external_urls_count = len(urls)
    suspicious_urls = sum(1 for u in urls if any(x in u.lower() for x in SUSPICIOUS_URL_HINTS))

    base64_hits = len(BASE64_RE.findall(code))

    eval_usage = lower.count("eval(")
    exec_usage = lower.count("exec(")

    network_calls_count = _count_any(lower, NET_HINTS)
    env_var_access = 1 if any(h.lower() in lower for h in ENV_HINTS) else 0

    file_read = 1 if any(h in lower for h in FS_READ_HINTS) else 0
    file_write = 1 if any(h in lower for h in FS_WRITE_HINTS) else 0

    crypto_operations = 1 if any(h in lower for h in CRYPTO_HINTS) else 0

    shell_command_exec = 1 if any(h in lower for h in SHELL_HINTS) else 0
    remote_code_download = 1 if any(h in lower for h in REMOTE_DL_HINTS) else 0

    data_exfiltration_patterns = 1 if any(h in lower for h in EXFIL_HINTS) else 0
    keylogger_patterns = 1 if any(h in lower for h in KEYLOGGER_HINTS) else 0
    backdoor_patterns = 1 if any(h in lower for h in BACKDOOR_HINTS) else 0

    minified_code = _minified_indicator(code)
    obfuscation_score = _obfuscation_score(code, base64_hits)

    return {
        "network_calls_count": int(min(network_calls_count, 30)),
        "external_urls_count": int(external_urls_count),
        "suspicious_urls": int(min(suspicious_urls, 20)),
        "env_var_access": int(env_var_access),
        "file_system_read_ops": int(10 if file_read else 0),
        "file_system_write_ops": int(10 if file_write else 0),
        "crypto_operations": int(crypto_operations),
        "obfuscation_score": float(obfuscation_score),
        "minified_code": int(minified_code),
        "eval_usage": int(min(eval_usage, 20)),
        "exec_usage": int(min(exec_usage, 20)),
        "base64_encoding": int(min(base64_hits, 20)),
        "shell_command_exec": int(shell_command_exec),
        "remote_code_download": int(remote_code_download),
        "data_exfiltration_patterns": int(data_exfiltration_patterns),
        "keylogger_patterns": int(keylogger_patterns),
        "backdoor_patterns": int(backdoor_patterns),
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
    return {
        "package_name": package_name,
        "ecosystem": ecosystem,

        "downloads_count": 0,
        "age_days": 0,

        "maintainer_changes": 0,
        "dependency_count": 0,
        "new_dependencies": 0,

        "code_lines_added": 0,
        "code_lines_removed": 0,
        "code_change_ratio": 0.0,

        "has_install_scripts": 0,
        "has_postinstall_hook": 0,

        "network_calls_count": 0,
        "external_urls_count": 0,
        "suspicious_urls": 0,

        "file_system_read_ops": 0,
        "file_system_write_ops": 0,
        "env_var_access": 0,

        "crypto_operations": 0,
        "obfuscation_score": 0.0,
        "minified_code": 0,

        "eval_usage": 0,
        "exec_usage": 0,
        "base64_encoding": 0,

        "shell_command_exec": 0,
        "remote_code_download": 0,

        "data_exfiltration_patterns": 0,
        "keylogger_patterns": 0,
        "backdoor_patterns": 0,

        "typosquatting_score": 0.0,
        "name_similarity_popular": 0.0,

        "author_email_disposable": 0,
        "author_new_account": 0,
        "has_readme": 0,
        "has_license": 0,
        "has_tests": 0,
        "version_jump_suspicious": 0,
        "release_time_anomaly": 0,

        # helper: whether we had deep package code available
        "scan_depth": "declared",
    }

def build_npm_row(name: str, pkg_dir: Path) -> Dict[str, float]:
    row = base_row(name, "npm")
    row["scan_depth"] = "installed"

    meta = npm_pkg_meta(pkg_dir)

    maintainers = meta.get("maintainers")
    if isinstance(maintainers, list):
        row["maintainer_changes"] = 1 if len(maintainers) <= 1 else 0

    deps = meta.get("dependencies", {}) or {}
    row["dependency_count"] = int(len(deps))

    scripts = meta.get("scripts", {}) or {}
    row["has_install_scripts"] = 1 if any(k in scripts for k in ["install", "preinstall", "postinstall"]) else 0
    row["has_postinstall_hook"] = 1 if "postinstall" in scripts else 0

    code_text, loc = _collect_code_text(pkg_dir, TEXT_EXTS_NPM)
    if code_text:
        row.update(scan_code_features(code_text))

    pkg_key = f"npm__{name.replace('/', '__')}"
    row.update(snapshot_and_diff(pkg_key, loc, code_text))
    return row

def build_pypi_row(name: str, pkg_dir: Path) -> Dict[str, float]:
    row = base_row(name, "pypi")
    row["scan_depth"] = "installed"

    # try parse requires-dist from dist-info if exists
    site = pkg_dir.parent
    dist_infos = list(site.glob(f"{name.replace('-', '_')}*.dist-info"))
    if dist_infos:
        meta_file = dist_infos[0] / "METADATA"
        if meta_file.exists():
            txt = _read_text_file(meta_file)
            row["dependency_count"] = int(sum(1 for line in txt.splitlines() if line.lower().startswith("requires-dist:")))

    code_text, loc = _collect_code_text(pkg_dir, TEXT_EXTS_PY)
    if code_text:
        row.update(scan_code_features(code_text))

    pkg_key = f"pypi__{name}"
    row.update(snapshot_and_diff(pkg_key, loc, code_text))
    return row

# ---------------- project-level scan (works on any upload) ----------------
def scan_project_source_for_risks(project_dir: Path) -> Dict[str, float]:
    code_text, _ = _collect_code_text(project_dir, TEXT_EXTS_PROJECT, max_files=500)
    if not code_text:
        return {}
    return scan_code_features(code_text)

# ---------------- prediction ----------------
def load_model():
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

def predict_rows(rows: List[Dict], threshold_safe=0.35, threshold_mal=0.65) -> List[Dict]:
    art = load_model()
    model = art["model"]
    scaler = art["scaler"]
    feature_cols = art["feature_cols"]
    explanations = art.get("feature_explanations", {})

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
    rows, project_risks = scan_project(project_dir)

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

if __name__ == "__main__":
    import sys
    proj = sys.argv[1] if len(sys.argv) > 1 else "."
    print(json.dumps(scan_and_predict(proj), indent=2))
