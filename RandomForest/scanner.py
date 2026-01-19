# Supply Chain Security Scanner v2.0
import pickle
import requests
import json
import re
import os
from datetime import datetime, timezone
import warnings
warnings.filterwarnings('ignore')



print("🔄 Loading Security Model...")
try:
    with open('security_model.pkl', 'rb') as f:
        model_data = pickle.load(f)
    model = model_data['model']
    scaler = model_data['scaler']
    feature_cols = model_data['feature_columns']
    explanations = model_data['feature_explanations']
    metrics = model_data['metrics']
    print(" Model Loaded!")
except FileNotFoundError:
    print(" Model not found! Run train_model.py first.")
    exit(1)


SECURITY_VIOLATIONS = {
    'BASE64_PAYLOAD': {
        'name': 'Base64 Encoded Payload',
        'severity': 'HIGH',
        'icon': '🔤',
        'description': 'Package contains Base64 encoded strings that may hide malicious payloads.',
        'risk': 'Attackers use Base64 to hide malicious code from static analysis.',
        'action': 'Decode and inspect all Base64 strings before installation.'
    },
    'FERNET_CRYPTO': {
        'name': 'Fernet Encryption Usage',
        'severity': 'MEDIUM',
        'icon': '🔐',
        'description': 'Package uses Fernet symmetric encryption.',
        'risk': 'May be used to encrypt stolen data before exfiltration.',
        'action': 'Review why encryption is needed in this package.'
    },
    'EVAL_EXEC': {
        'name': 'Dynamic Code Execution',
        'severity': 'CRITICAL',
        'icon': '⚡',
        'description': 'Package uses eval() or exec() to run dynamic code.',
        'risk': 'Allows execution of arbitrary code at runtime - major security risk.',
        'action': 'AVOID THIS PACKAGE - eval/exec is extremely dangerous.'
    },
    'OBFUSCATED': {
        'name': 'Obfuscated Code',
        'severity': 'HIGH',
        'icon': '🔒',
        'description': 'Code appears to be obfuscated to hide its true purpose.',
        'risk': 'Legitimate packages rarely obfuscate code. This hides malicious intent.',
        'action': 'Do not install packages with obfuscated code.'
    },
    'NETWORK_SUSPICIOUS': {
        'name': 'Suspicious Network Activity',
        'severity': 'HIGH',
        'icon': '🌐',
        'description': 'Package makes network connections to suspicious domains.',
        'risk': 'May exfiltrate data or download additional malware.',
        'action': 'Check network destinations before installation.'
    },
    'FILE_SENSITIVE': {
        'name': 'Sensitive File Access',
        'severity': 'CRITICAL',
        'icon': '📂',
        'description': 'Package accesses sensitive files (.env, .ssh, credentials).',
        'risk': 'Likely attempting to steal credentials or SSH keys.',
        'action': 'DO NOT INSTALL - credential theft detected.'
    },
    'ENV_EXFIL': {
        'name': 'Environment Variable Access',
        'severity': 'HIGH',
        'icon': '🔑',
        'description': 'Package reads environment variables.',
        'risk': 'May steal API keys, tokens, and secrets stored in ENV.',
        'action': 'Review if ENV access is necessary for this package.'
    },
    'SHELL_EXEC': {
        'name': 'Shell Command Execution',
        'severity': 'CRITICAL',
        'icon': '🐚',
        'description': 'Package executes shell/system commands.',
        'risk': 'Can execute any command on your system with your permissions.',
        'action': 'Carefully review all shell commands before installing.'
    },
    'BACKDOOR': {
        'name': 'Backdoor Pattern',
        'severity': 'CRITICAL',
        'icon': '🚪',
        'description': 'Package contains backdoor or reverse shell patterns.',
        'risk': 'Allows attacker remote access to your system.',
        'action': 'DO NOT INSTALL - this is malware!'
    },
    'TYPOSQUAT': {
        'name': 'Typosquatting',
        'severity': 'HIGH',
        'icon': '🎭',
        'description': 'Package name is similar to a popular package.',
        'risk': 'Attackers create fake packages with similar names to trick users.',
        'action': 'Verify you have the correct package name.'
    },
    'NEW_UNTRUSTED': {
        'name': 'New Untrusted Package',
        'severity': 'MEDIUM',
        'icon': '⚠️',
        'description': 'Package is very new with few downloads.',
        'risk': 'New packages have not been vetted by the community.',
        'action': 'Wait for package to gain community trust.'
    },
    'INSTALL_SCRIPT': {
        'name': 'Install Script with Network',
        'severity': 'HIGH',
        'icon': '',
        'description': 'Package has install scripts that make network calls.',
        'risk': 'Can download and execute malware during installation.',
        'action': 'Review postinstall scripts before installing.'
    },
    'LIFECYCLE_SCRIPT': {
        'name': 'Lifecycle Script Detected',
        'severity': 'MEDIUM',
        'icon': '',
        'description': 'Package has lifecycle scripts (preinstall/postinstall).',
        'risk': 'Scripts run automatically during npm install.',
        'action': 'Review all lifecycle scripts before installing.'
    }
}

# Suspicious tokens to detect in scripts
SUSPICIOUS_TOKENS = [
    'curl', 'wget', 'powershell', 'pwsh', 'invoke-webrequest', 'iwr',
    'node -e', 'bash -c', 'sh -c', 'cmd /c', 'child_process', 
    'execsync', 'spawn', 'eval(', 'exec(', 'require("child_process")',
    'http://', 'https://', '.sh', 'payload', 'download'
]

LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'postuninstall']

def analyze_package_json(data):
    """
    Analyze package.json for package-level security risks.
    Returns: (package_verdict, pkg_violations, risk_score, details)
    """
    pkg_name = data.get('name', 'unknown')
    scripts = data.get('scripts', {})
    
    pkg_violations = []
    details = []
    risk_score = 0
    
    # 1. Check for lifecycle scripts
    found_lifecycle = []
    for script_name in LIFECYCLE_SCRIPTS:
        if script_name in scripts:
            found_lifecycle.append(script_name)
    
    if found_lifecycle:
        pkg_violations.append('LIFECYCLE_SCRIPT')
        details.append(f"Lifecycle scripts: {', '.join(found_lifecycle)}")
        risk_score += 30
    
    # 2. Scan script contents for suspicious tokens
    malicious_tokens_found = []
    for script_name, script_content in scripts.items():
        if script_name in LIFECYCLE_SCRIPTS:
            content_lower = script_content.lower()
            for token in SUSPICIOUS_TOKENS:
                if token.lower() in content_lower:
                    malicious_tokens_found.append(f"{token} in {script_name}")
    
    if malicious_tokens_found:
        pkg_violations.append('INSTALL_SCRIPT')
        details.append(f"Suspicious tokens: {', '.join(malicious_tokens_found[:3])}")
        risk_score += 50
    
    # 3. Check for typosquatting
    is_typo, similar = check_typosquatting(pkg_name, 'npm')
    if is_typo:
        pkg_violations.append('TYPOSQUAT')
        details.append(f"Similar to: {similar}")
        risk_score += 40
    
    # 4. Check for suspicious scoped package patterns
    if '@' in pkg_name:
        suspicious_scopes = ['aciton', 'actons', 'actios', 'goggle', 'gogle', 'mircosoft', 'amazion']
        for sus in suspicious_scopes:
            if sus in pkg_name.lower():
                if 'TYPOSQUAT' not in pkg_violations:
                    pkg_violations.append('TYPOSQUAT')
                details.append(f"Suspicious scope pattern: {sus}")
                risk_score += 40
                break
    
    # Determine package verdict
    if 'INSTALL_SCRIPT' in pkg_violations:
        package_verdict = 'MALICIOUS'
        risk_score = min(risk_score, 95)
    elif pkg_violations:
        package_verdict = 'SUSPICIOUS'
        risk_score = min(risk_score, 70)
    else:
        package_verdict = 'SAFE'
        risk_score = max(0, risk_score)
    
    return package_verdict, pkg_violations, risk_score, details

def fetch_npm(name):
    """Fetch npm package"""
    try:
        resp = requests.get(f"https://registry.npmjs.org/{name}", timeout=10)
        if resp.status_code == 404:
            return None, "Package not found"
        data = resp.json()
        latest = data.get('dist-tags', {}).get('latest', '0.0.0')
        version_data = data.get('versions', {}).get(latest, {})
        
        time_info = data.get('time', {})
        created = time_info.get('created', '')
        age_days = 0
        if created:
            created_dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
            age_days = (datetime.now(timezone.utc) - created_dt).days
        
        try:
            dl_resp = requests.get(f"https://api.npmjs.org/downloads/point/last-week/{name}", timeout=5)
            downloads = dl_resp.json().get('downloads', 0) * 52
        except:
            downloads = 0
        
        scripts = version_data.get('scripts', {})
        
        return {
            'name': name, 'version': latest, 'ecosystem': 'npm',
            'downloads': downloads, 'age_days': age_days,
            'maintainers': len(data.get('maintainers', [])),
            'dependencies': len(version_data.get('dependencies', {})),
            'has_install_script': bool(scripts.get('postinstall') or scripts.get('preinstall')),
            'has_readme': bool(data.get('readme')),
            'has_license': bool(data.get('license'))
        }, None
    except Exception as e:
        return None, str(e)

def fetch_pypi(name):
    """Fetch PyPI package"""
    try:
        resp = requests.get(f"https://pypi.org/pypi/{name}/json", timeout=10)
        if resp.status_code == 404:
            return None, "Package not found"
        data = resp.json()
        info = data.get('info', {})
        releases = data.get('releases', {})
        
        all_dates = []
        for version, files in releases.items():
            for f in files:
                if f.get('upload_time'):
                    all_dates.append(f['upload_time'])
        
        age_days = 0
        if all_dates:
            first = min(all_dates)
            created_dt = datetime.fromisoformat(first)
            age_days = (datetime.now() - created_dt).days
        
        return {
            'name': name, 'version': info.get('version', '0.0.0'), 'ecosystem': 'pypi',
            'downloads': 0, 'age_days': age_days,
            'maintainers': 1,
            'dependencies': len(info.get('requires_dist') or []),
            'has_install_script': False,
            'has_readme': bool(info.get('description')),
            'has_license': bool(info.get('license'))
        }, None
    except Exception as e:
        return None, str(e)

def parse_requirements(content):
    """Parse requirements.txt content"""
    packages = []
    for line in content.strip().split('\n'):
        line = line.strip()
        if line and not line.startswith('#'):
            # Extract package name (remove version specifiers)
            name = re.split(r'[<>=!~\[]', line)[0].strip()
            if name:
                packages.append(name)
    return packages


POPULAR = {
    'npm': ['react', 'express', 'lodash', 'axios', 'moment', 'vue', 'webpack', 'typescript'],
    'pypi': ['requests', 'numpy', 'pandas', 'flask', 'django', 'scipy', 'boto3', 'pytest']
}

def check_typosquatting(name, ecosystem):
    pop = POPULAR.get(ecosystem, [])
    for p in pop:
        if name != p and (p in name or name in p or len(set(p)&set(name))/len(set(p)|set(name)) > 0.7):
            return True, p
    return False, None

def analyze_package(pkg_info, json_data=None):
    """Analyze package and detect violations"""
    violations = []
    
    # Get data from JSON input if provided
    if json_data:
        pkg_info = {
            'name': json_data.get('name', 'unknown'),
            'version': json_data.get('version', '0.0.0'),
            'ecosystem': json_data.get('ecosystem', 'npm'),
            'downloads': json_data.get('downloads', 100),
            'age_days': json_data.get('age_days', 100),
            'maintainers': json_data.get('maintainers', 1),
            'dependencies': json_data.get('dependencies', 0),
            'has_install_script': json_data.get('install_script', False),
            'has_readme': json_data.get('has_readme', True),
            'has_license': json_data.get('has_license', True)
        }
        
        # Check JSON-provided indicators
        if json_data.get('base64_strings', 0) > 0 or json_data.get('base64', False):
            violations.append('BASE64_PAYLOAD')
        if json_data.get('fernet', False) or json_data.get('fernet_usage', False):
            violations.append('FERNET_CRYPTO')
        if json_data.get('eval', 0) > 0 or json_data.get('exec', 0) > 0:
            violations.append('EVAL_EXEC')
        if json_data.get('obfuscation', 0) > 0.5 or json_data.get('obfuscated', False):
            violations.append('OBFUSCATED')
        if json_data.get('shell_commands', 0) > 0 or json_data.get('shell', False):
            violations.append('SHELL_EXEC')
        if json_data.get('sensitive_paths', 0) > 0:
            violations.append('FILE_SENSITIVE')
        if json_data.get('env_access', False) or json_data.get('env_var_access', False):
            violations.append('ENV_EXFIL')
        if json_data.get('backdoor', False) or json_data.get('reverse_shell', False):
            violations.append('BACKDOOR')
        if json_data.get('suspicious_domains', 0) > 0:
            violations.append('NETWORK_SUSPICIOUS')
        if json_data.get('typosquatting_score', 0) > 0.5:
            violations.append('TYPOSQUAT')
    
    # Check metadata-based violations
    if pkg_info.get('downloads', 0) < 100 and pkg_info.get('age_days', 0) < 30:
        violations.append('NEW_UNTRUSTED')
    
    if pkg_info.get('has_install_script'):
        violations.append('INSTALL_SCRIPT')
    
    # Check typosquatting
    is_typo, similar_to = check_typosquatting(pkg_info['name'], pkg_info.get('ecosystem', 'npm'))
    if is_typo and 'TYPOSQUAT' not in violations:
        violations.append('TYPOSQUAT')
        pkg_info['similar_to'] = similar_to
    
    return pkg_info, violations

def build_features(pkg_info, violations, json_data=None):
    """Build ML feature vector"""
    features = {c: 0 for c in feature_cols}
    
    features['downloads_count'] = pkg_info.get('downloads', 0)
    features['age_days'] = pkg_info.get('age_days', 0)
    features['maintainers_count'] = pkg_info.get('maintainers', 1)
    features['dependencies_count'] = pkg_info.get('dependencies', 0)
    features['author_account_age_days'] = pkg_info.get('age_days', 0)
    features['has_readme'] = 1 if pkg_info.get('has_readme') else 0
    features['has_license'] = 1 if pkg_info.get('has_license') else 0
    
    if json_data:
        features['base64_encoded_strings'] = json_data.get('base64_strings', 0)
        features['fernet_usage'] = 1 if json_data.get('fernet') else 0
        features['eval_calls'] = json_data.get('eval', 0)
        features['exec_calls'] = json_data.get('exec', 0)
        features['obfuscation_score'] = json_data.get('obfuscation', 0)
        features['shell_commands'] = json_data.get('shell_commands', 0)
        features['sensitive_paths_accessed'] = json_data.get('sensitive_paths', 0)
        features['env_var_access'] = 1 if json_data.get('env_access') else 0
        features['backdoor_patterns'] = 1 if json_data.get('backdoor') else 0
        features['typosquatting_score'] = json_data.get('typosquatting_score', 0)
    
    # Set features based on violations
    if 'BASE64_PAYLOAD' in violations:
        features['base64_encoded_strings'] = max(features.get('base64_encoded_strings', 0), 10)
    if 'EVAL_EXEC' in violations:
        features['eval_calls'] = max(features.get('eval_calls', 0), 5)
    if 'OBFUSCATED' in violations:
        features['obfuscation_score'] = max(features.get('obfuscation_score', 0), 0.8)
    if 'BACKDOOR' in violations:
        features['backdoor_patterns'] = 1
    
    return features

def predict(features):
    """Make ML prediction"""
    vec = [features.get(c, 0) for c in feature_cols]
    scaled = scaler.transform([vec])[0]
    pred = model.predict([scaled])[0]
    prob = model.predict_proba([scaled])[0]
    return bool(pred), prob[1], prob[0]
 

def show_metrics():
    """Display model metrics"""
    print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║                    📊 ML MODEL METRICS                               ║
╠══════════════════════════════════════════════════════════════════════╣
║  Model Type:     Random Forest Classifier                           ║
║  Training Data:  500 samples (250 malicious, 250 genuine)            ║
║  Features:       65 security indicators                              ║
╠══════════════════════════════════════════════════════════════════════╣
║  ✅ Accuracy:     {metrics['accuracy']:.2%}                                           ║
║  🎯 Precision:    {metrics['precision']:.2%}                                           ║
║  📊 Recall:       {metrics['recall']:.2%}                                           ║
║  📈 F1-Score:     {metrics['f1_score']:.2%}                                           ║
║  📉 ROC-AUC:      {metrics['roc_auc']:.2%}                                           ║
║  🔄 CV Mean:      {metrics['cv_mean']:.2%}                                           ║
╚══════════════════════════════════════════════════════════════════════╝
""")

def show_result(pkg_info, violations, is_malicious, mal_prob, safe_prob):
    """Display analysis result with clear violations"""
    
    # Determine verdict
    if is_malicious or mal_prob > 0.5:
        verdict = "🚨 MALICIOUS"
        verdict_color = "CRITICAL"
    elif len(violations) >= 3 or mal_prob > 0.3:
        verdict = "⚠️ SUSPICIOUS"
        verdict_color = "HIGH"
    elif len(violations) >= 1:
        verdict = "⚡ POTENTIALLY UNSAFE"
        verdict_color = "MEDIUM"
    else:
        verdict = "✅ SAFE"
        verdict_color = "LOW"
    
    risk_score = min(100, int(mal_prob * 100) + len(violations) * 10)
    
    # Header
    print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║                    🛡️ SECURITY SCAN RESULT                           ║
╠══════════════════════════════════════════════════════════════════════╣
║  📦 Package:      {pkg_info['name']:<50}║
║  📌 Version:      {pkg_info['version']:<50}║
║  🌐 Ecosystem:    {pkg_info['ecosystem'].upper():<50}║
║  📥 Downloads:    {pkg_info.get('downloads', 0):<50,}║
╠══════════════════════════════════════════════════════════════════════╣
║  🎯 VERDICT:      {verdict:<50}║
║  📊 Risk Score:   {risk_score}/100{' ':<45}║
║  🤖 ML Malicious: {mal_prob:.1%}{' ':<49}║
║  ✅ ML Safe:      {safe_prob:.1%}{' ':<49}║
╚══════════════════════════════════════════════════════════════════════╝
""")
    
    # Risk bar
    bar_len = int(mal_prob * 50)
    bar = "█" * bar_len + "░" * (50 - bar_len)
    print(f"   Safe [{bar}] Malicious\n")
    
    # SECURITY VIOLATIONS - DETAILED
    if violations:
        print("╔══════════════════════════════════════════════════════════════════════╗")
        print("║              🚨 SECURITY VIOLATIONS DETECTED                         ║")
        print("╚══════════════════════════════════════════════════════════════════════╝\n")
        
        for i, v_code in enumerate(violations, 1):
            v = SECURITY_VIOLATIONS.get(v_code, {})
            severity = v.get('severity', 'MEDIUM')
            sev_icon = "🔴" if severity == 'CRITICAL' else "🟠" if severity == 'HIGH' else "🟡"
            
            print(f"   ┌─────────────────────────────────────────────────────────────────┐")
            print(f"   │ {sev_icon} VIOLATION #{i}: {v.get('name', v_code):<47}│")
            print(f"   ├─────────────────────────────────────────────────────────────────┤")
            print(f"   │ Severity: {severity:<55}│")
            print(f"   │                                                                 │")
            print(f"   │ 📋 Description:                                                 │")
            desc = v.get('description', 'Unknown violation')
            for line in [desc[i:i+60] for i in range(0, len(desc), 60)]:
                print(f"   │    {line:<61}│")
            print(f"   │                                                                 │")
            print(f"   │ ⚠️ Risk:                                                         │")
            risk = v.get('risk', 'Unknown risk')
            for line in [risk[i:i+60] for i in range(0, len(risk), 60)]:
                print(f"   │    {line:<61}│")
            print(f"   │                                                                 │")
            print(f"   │ 🛠️ Action:                                                       │")
            action = v.get('action', 'Review package carefully')
            for line in [action[i:i+60] for i in range(0, len(action), 60)]:
                print(f"   │    {line:<61}│")
            print(f"   └─────────────────────────────────────────────────────────────────┘\n")
        
        # Summary
        critical = sum(1 for v in violations if SECURITY_VIOLATIONS.get(v, {}).get('severity') == 'CRITICAL')
        high = sum(1 for v in violations if SECURITY_VIOLATIONS.get(v, {}).get('severity') == 'HIGH')
        
        print(f"   📊 VIOLATION SUMMARY:")
        print(f"   ─────────────────────────────────────────────────────────────────")
        print(f"   Total Violations: {len(violations)}")
        print(f"    Critical: {critical}  |   High: {high}  |   Medium: {len(violations) - critical - high}")
        
        if verdict_color in ['CRITICAL', 'HIGH']:
            print(f"""

║   RECOMMENDATION: DO NOT INSTALL THIS PACKAGE!                     ║
║     This package shows signs of malicious behavior.                  ║

""")
    else:
        print("""
   ✅ NO SECURITY VIOLATIONS DETECTED
   ─────────────────────────────────────────────────────────────────
   • Package metadata looks legitimate
   • No malicious patterns found
   • No suspicious code indicators
   
   ✅ RECOMMENDATION: Package appears safe to install.
""")


def main():
    print("""

           SUPPLY CHAIN SECURITY SCANNER               
                                                                   
 Detect malicious packages with ML-powered analysis                  

    """)
    
    while True:
        print("""
📋 SCAN OPTIONS:
   1. 🔍 Scan npm package (by name)
   2. 🐍 Scan PyPI package (by name)
   3. 📄 Scan JSON package data
   4. 📋 Scan requirements.txt
   5.  Exit
""")
        choice = input("   Select (1-5): ").strip()
        
        if choice == '1':
            name = input("\n   📦 npm package name: ").strip()
            if not name:
                continue
            print(f"\n   🔄 Fetching {name} from npm...")
            pkg, err = fetch_npm(name)
            if err:
                print(f"   ❌ {err}")
                continue
            print(f"   ✅ Found: {pkg['name']} v{pkg['version']}")
            pkg, violations = analyze_package(pkg)
            features = build_features(pkg, violations)
            is_mal, mal_prob, safe_prob = predict(features)
            show_result(pkg, violations, is_mal, mal_prob, safe_prob)
            
        elif choice == '2':
            name = input("\n   🐍 PyPI package name: ").strip()
            if not name:
                continue
            print(f"\n   🔄 Fetching {name} from PyPI...")
            pkg, err = fetch_pypi(name)
            if err:
                print(f"   ❌ {err}")
                continue
            print(f"   ✅ Found: {pkg['name']} v{pkg['version']}")
            pkg, violations = analyze_package(pkg)
            features = build_features(pkg, violations)
            is_mal, mal_prob, safe_prob = predict(features)
            show_result(pkg, violations, is_mal, mal_prob, safe_prob)
            
        elif choice == '3':
            print("\n   📄 Enter path to package.json OR paste JSON (multi-line OK):")
            print("   (For multi-line, paste all lines then press Enter twice)")
            
            lines = []
            empty_count = 0
            while True:
                line = input("   > " if not lines else "   . ")
                if line == "":
                    empty_count += 1
                    if empty_count >= 2 or (lines and lines[-1] == "}"):
                        break
                else:
                    empty_count = 0
                    lines.append(line)
            
            inp = "\n".join(lines).strip()
            if not inp:
                continue
            
            try:
                # Check if it's a file path
                if os.path.exists(inp.split('\n')[0].strip()):
                    with open(inp.split('\n')[0].strip(), 'r') as f:
                        data = json.load(f)
                else:
                    data = json.loads(inp)
                
                # Check if it's a package.json (has dependencies OR scripts OR name)
                if 'dependencies' in data or 'scripts' in data or 'name' in data:
                    pkg_name = data.get('name', 'unknown')
                    deps = data.get('dependencies', {})
                    
                    print(f"\n   Detected package.json: {pkg_name}")
                    
                    # 1. ANALYZE PACKAGE-LEVEL SECURITY
                    pkg_verdict, pkg_violations, pkg_risk, pkg_details = analyze_package_json(data)
                    
                    # Show package-level results
                    if pkg_verdict == 'MALICIOUS':
                        print(f"\n    PACKAGE-LEVEL: MALICIOUS")
                        print(f"   Risk Score: {pkg_risk}/100")
                        for v in pkg_violations:
                            v_info = SECURITY_VIOLATIONS.get(v, {})
                            print(f"      {v_info.get('name', v)}")
                        for d in pkg_details:
                            print(f"      -> {d}")
                        print(f"\n    DO NOT INSTALL THIS PACKAGE!")
                    elif pkg_verdict == 'SUSPICIOUS':
                        print(f"\n    PACKAGE-LEVEL: SUSPICIOUS")
                        print(f"   Risk Score: {pkg_risk}/100")
                        for v in pkg_violations:
                            v_info = SECURITY_VIOLATIONS.get(v, {})
                            print(f"      {v_info.get('name', v)}")
                        for d in pkg_details:
                            print(f"      -> {d}")
                    else:
                        print(f"\n    PACKAGE-LEVEL: SAFE")
                        print(f"   Risk Score: {pkg_risk}/100")
                    
                    # 2. SCAN DEPENDENCIES
                    print(f"\n   Found {len(deps)} dependencies to scan...")
                    
                    dep_results = []
                    dep_mal = 0
                    dep_sus = 0
                    dep_safe = 0
                    
                    for dep_name, version in deps.items():
                        print(f"\n    Scanning: {dep_name}")
                        pkg, err = fetch_npm(dep_name)
                        if err:
                            print(f"       {err}")
                            continue
                        
                        pkg, violations = analyze_package(pkg)
                        features = build_features(pkg, violations)
                        is_mal, mal_prob, safe_prob = predict(features)
                        
                        if is_mal or mal_prob > 0.5:
                            dep_verdict = 'MALICIOUS'
                            dep_mal += 1
                        elif violations:
                            dep_verdict = 'SUSPICIOUS'
                            dep_sus += 1
                        else:
                            dep_verdict = 'SAFE'
                            dep_safe += 1
                        
                        status_icon = "" if dep_verdict == 'MALICIOUS' else "" if dep_verdict == 'SUSPICIOUS' else ""
                        print(f"      {status_icon} {dep_verdict} - {mal_prob:.0%} risk, {len(violations)} violations")
                        
                        if violations:
                            for v in violations[:2]:
                                v_info = SECURITY_VIOLATIONS.get(v, {})
                                print(f"         -> {v_info.get('name', v)}")
                        
                        dep_results.append({
                            'name': dep_name,
                            'verdict': dep_verdict,
                            'probability': mal_prob,
                            'violations': violations
                        })
                    
                    # 3. CALCULATE OVERALL VERDICT
                    if pkg_verdict == 'MALICIOUS' or dep_mal > 0:
                        overall = 'MALICIOUS'
                    elif pkg_verdict == 'SUSPICIOUS' or dep_sus > 0:
                        overall = 'SUSPICIOUS'
                    else:
                        overall = 'SAFE'
                    
                    # 4. INTEGRATED SUMMARY
                    total_scanned = 1 + len(dep_results)
                    total_mal = (1 if pkg_verdict == 'MALICIOUS' else 0) + dep_mal
                    total_sus = (1 if pkg_verdict == 'SUSPICIOUS' else 0) + dep_sus
                    total_safe = (1 if pkg_verdict == 'SAFE' else 0) + dep_safe
                    
                    print(f"\n{'='*60}")
                    print(f" SCAN COMPLETE")
                    print(f"{'='*60}")
                    
                    # Overall Verdict
                    if overall == 'MALICIOUS':
                        print(f"\n    OVERALL VERDICT: MALICIOUS")
                    elif overall == 'SUSPICIOUS':
                        print(f"\n    OVERALL VERDICT: SUSPICIOUS")
                    else:
                        print(f"\n    OVERALL VERDICT: SAFE")
                    
                    # Package Summary
                    print(f"\n   PACKAGE: {pkg_name}")
                    pkg_icon = "" if pkg_verdict == 'MALICIOUS' else "" if pkg_verdict == 'SUSPICIOUS' else ""
                    print(f"      Verdict: {pkg_icon} {pkg_verdict}")
                    print(f"      Risk: {pkg_risk}/100")
                    if pkg_violations:
                        print(f"      Violations: {', '.join(pkg_violations)}")
                    
                    # Dependency Summary
                    if len(deps) > 0:
                        print(f"\n   DEPENDENCIES: ({len(dep_results)} scanned)")
                        print(f"       Malicious: {dep_mal}")
                        print(f"       Suspicious: {dep_sus}")
                        print(f"       Safe: {dep_safe}")
                    
                    # Totals
                    print(f"\n   TOTALS: ({total_scanned} items)")
                    print(f"       Malicious: {total_mal}")
                    print(f"       Suspicious: {total_sus}")
                    print(f"       Safe: {total_safe}")
                    
                    if overall == 'MALICIOUS':
                        print(f"\n    ACTION: Do not install! Remove this package.")
                else:
                    # Single package JSON
                    pkg, violations = analyze_package({}, data)
                    features = build_features(pkg, violations, data)
                    is_mal, mal_prob, safe_prob = predict(features)
                    show_result(pkg, violations, is_mal, mal_prob, safe_prob)
                    
            except json.JSONDecodeError as e:
                print(f"    Invalid JSON: {e}")
            
        elif choice == '4':
            print("\n   📋 Enter path to requirements.txt (or paste content):")
            inp = input("   > ").strip()
            
            # Check if it's a file path
            if os.path.exists(inp):
                with open(inp, 'r') as f:
                    content = f.read()
            else:
                content = inp
            
            packages = parse_requirements(content)
            if not packages:
                print("    No packages found")
                continue
            
            print(f"\n   📦 Found {len(packages)} packages to scan...")
            
            all_violations = []
            for pkg_name in packages:
                print(f"\n   🔄 Scanning: {pkg_name}")
                pkg, err = fetch_pypi(pkg_name)
                if err:
                    print(f"      ❌ {err}")
                    continue
                pkg, violations = analyze_package(pkg)
                features = build_features(pkg, violations)
                is_mal, mal_prob, safe_prob = predict(features)
                
                status = "🚨 MALICIOUS" if is_mal else "⚠️ SUSPICIOUS" if violations else "✅ SAFE"
                print(f"      {status} - {len(violations)} violations, {mal_prob:.0%} risk")
                
                if violations:
                    all_violations.append((pkg_name, violations, mal_prob))
            
            print(f"\n{'═'*60}")
            print(f"📊 REQUIREMENTS.TXT SCAN COMPLETE")
            print(f"{'═'*60}")
            print(f"   Packages scanned: {len(packages)}")
            print(f"   Packages with issues: {len(all_violations)}")
            
            if all_violations:
                print(f"\n   🚨 PACKAGES WITH SECURITY ISSUES:")
                for pkg_name, violations, prob in all_violations:
                    print(f"      • {pkg_name}: {', '.join(violations[:3])}")
            
        elif choice == '5':
            print("\n Stay safe from supply chain attacks!\n")
            break
        
        input("\n   Press Enter to continue..")

if __name__ == "__main__":
    main()
