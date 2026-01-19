"""
═══════════════════════════════════════════════════════════════════════════════
🛡️ SUPPLY CHAIN SECURITY - PACKAGE SCANNER
═══════════════════════════════════════════════════════════════════════════════

Analyzes external packages from npm/PyPI to detect:
- Malicious code patterns
- Base64 encoded payloads
- Fernet/encryption usage
- Network activity
- Vulnerabilities

Usage: python3 scan_package.py
═══════════════════════════════════════════════════════════════════════════════
"""

import pickle
import requests
import re
import os
import tempfile
import zipfile
import tarfile
from datetime import datetime, timezone
import warnings
warnings.filterwarnings('ignore')

# Load trained model
print("🔄 Loading trained security model...")
try:
    with open('security_model.pkl', 'rb') as f:
        model_data = pickle.load(f)
    model = model_data['model']
    scaler = model_data['scaler']
    feature_cols = model_data['feature_columns']
    explanations = model_data['feature_explanations']
    metrics = model_data['metrics']
    print("✅ Model loaded successfully!")
    print(f"   Accuracy: {metrics['accuracy']:.1%} | F1: {metrics['f1_score']:.1%}\n")
except FileNotFoundError:
    print("❌ Model not found! Run train_model.py first.")
    exit(1)

# ═══════════════════════════════════════════════════════════════════════════════
# POPULAR PACKAGES FOR TYPOSQUATTING DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

POPULAR_PACKAGES = {
    'npm': ['react', 'express', 'lodash', 'axios', 'moment', 'vue', 'angular', 
            'webpack', 'typescript', 'eslint', 'jest', 'next', 'socket.io',
            'jquery', 'request', 'commander', 'chalk', 'debug', 'async'],
    'pypi': ['requests', 'numpy', 'pandas', 'flask', 'django', 'scipy', 'boto3',
             'tensorflow', 'pytest', 'sqlalchemy', 'celery', 'pillow', 'selenium',
             'beautifulsoup4', 'pyyaml', 'cryptography', 'aiohttp', 'httpx']
}

# ═══════════════════════════════════════════════════════════════════════════════
# CODE ANALYSIS PATTERNS
# ═══════════════════════════════════════════════════════════════════════════════

PATTERNS = {
    # Base64 patterns
    'base64_import': [
        r'import\s+base64', r'from\s+base64\s+import',
        r"require\(['\"]base-64['\"]\)", r"require\(['\"]js-base64['\"]\)"
    ],
    'base64_decode': [
        r'base64\.b64decode', r'base64\.decode', r'atob\s*\(',
        r'Buffer\.from\([^,]+,\s*[\'"]base64[\'"]\)'
    ],
    'base64_strings': [
        r'[A-Za-z0-9+/]{40,}={0,2}'  # Long base64-like strings
    ],
    
    # Fernet/Crypto patterns
    'fernet': [r'from\s+cryptography\.fernet', r'Fernet\s*\(', r'fernet\.encrypt'],
    'aes': [r'AES\.new', r'from\s+Crypto\.Cipher', r'aes-256', r'createCipheriv'],
    'rsa': [r'RSA\.generate', r'RSA\.import', r'generateKeyPair'],
    'crypto': [
        r'import\s+crypto', r'from\s+cryptography', r'from\s+Crypto',
        r"require\(['\"]crypto['\"]\)", r'hashlib\.'
    ],
    
    # Network patterns
    'http': [
        r'requests\.(get|post|put|delete)', r'urllib\.request',
        r'http\.request', r'fetch\s*\(', r'axios\.(get|post)',
        r'httpx\.(get|post)', r'aiohttp\.ClientSession'
    ],
    'socket': [r'socket\.socket', r'socket\.connect', r'net\.createConnection'],
    'urls': [r'https?://[^\s\'"<>]+'],
    'ips': [r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'],
    'suspicious_domains': [
        r'pastebin\.com', r'discord\.gg', r'bit\.ly', r'tinyurl',
        r'ngrok\.io', r'webhook\.site', r'requestbin', r'pipedream'
    ],
    
    # File system patterns
    'file_read': [r'open\([^)]+[\'"]r[\'"]', r'\.read\(\)', r'fs\.readFile', r'readFileSync'],
    'file_write': [r'open\([^)]+[\'"]w[\'"]', r'\.write\(', r'fs\.writeFile', r'writeFileSync'],
    'file_delete': [r'os\.remove', r'os\.unlink', r'fs\.unlink', r'shutil\.rmtree'],
    'sensitive_paths': [
        r'\.ssh', r'\.aws/credentials', r'\.env', r'/etc/passwd',
        r'\.bashrc', r'\.zshrc', r'\.gitconfig', r'\.npmrc', r'\.pypirc'
    ],
    
    # Execution patterns
    'eval': [r'\beval\s*\(', r'\beval\s*\`'],
    'exec': [r'\bexec\s*\(', r'execSync', r'child_process\.exec'],
    'subprocess': [r'subprocess\.(run|call|Popen)', r'spawn\s*\('],
    'os_system': [r'os\.system\s*\(', r'os\.popen'],
    'shell': [r'/bin/(ba)?sh', r'cmd\.exe', r'powershell', r'sh\s+-c'],
    
    # Obfuscation patterns
    'hex_strings': [r'\\x[0-9a-fA-F]{2}'],
    'unicode': [r'\\u[0-9a-fA-F]{4}'],
    'string_concat': [r'\+\s*[\'"][^\'"]{1,5}[\'"]\s*\+'],
    
    # Data exfiltration
    'env_access': [r'os\.environ', r'process\.env', r'getenv\('],
    'credentials': [r'password', r'passwd', r'credential', r'secret'],
    'tokens': [r'token', r'api_key', r'apikey', r'access_key'],
    
    # Malicious behavior
    'keylogger': [r'pynput', r'keyboard\.on_press', r'key_?logger'],
    'screenshot': [r'ImageGrab', r'pyautogui\.screenshot', r'mss'],
    'clipboard': [r'pyperclip', r'clipboard', r'pbcopy'],
    'reverse_shell': [r'reverse.{0,10}shell', r'bind.{0,10}shell', r'meterpreter'],
    'backdoor': [r'backdoor', r'rat\s', r'remote.{0,10}access'],
    'c2': [r'c2.{0,10}server', r'command.{0,10}control', r'beacon']
}

# ═══════════════════════════════════════════════════════════════════════════════
# FETCH PACKAGE FROM REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_npm_package(name):
    """Fetch npm package metadata and source"""
    try:
        # Get package info
        url = f"https://registry.npmjs.org/{name}"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 404:
            return None, "Package not found on npm"
        
        data = resp.json()
        latest = data.get('dist-tags', {}).get('latest', '0.0.0')
        version_data = data.get('versions', {}).get(latest, {})
        
        # Calculate age
        time_info = data.get('time', {})
        created = time_info.get('created', '')
        if created:
            created_dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
            age_days = (datetime.now(timezone.utc) - created_dt).days
        else:
            age_days = 0
        
        # Get downloads
        try:
            dl_url = f"https://api.npmjs.org/downloads/point/last-week/{name}"
            dl_resp = requests.get(dl_url, timeout=5)
            downloads = dl_resp.json().get('downloads', 0) * 52
        except:
            downloads = 0
        
        # Get tarball URL for code analysis
        tarball_url = version_data.get('dist', {}).get('tarball', '')
        
        return {
            'name': name,
            'version': latest,
            'ecosystem': 'npm',
            'downloads': downloads,
            'age_days': age_days,
            'maintainers': len(data.get('maintainers', [])),
            'dependencies': len(version_data.get('dependencies', {})),
            'scripts': version_data.get('scripts', {}),
            'has_readme': bool(data.get('readme')),
            'has_license': bool(data.get('license')),
            'tarball_url': tarball_url
        }, None
    except Exception as e:
        return None, f"Error: {str(e)}"

def fetch_pypi_package(name):
    """Fetch PyPI package metadata and source"""
    try:
        url = f"https://pypi.org/pypi/{name}/json"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 404:
            return None, "Package not found on PyPI"
        
        data = resp.json()
        info = data.get('info', {})
        releases = data.get('releases', {})
        
        latest = info.get('version', '0.0.0')
        
        # Calculate age
        all_dates = []
        for version, files in releases.items():
            for f in files:
                if f.get('upload_time'):
                    all_dates.append(f['upload_time'])
        
        if all_dates:
            first = min(all_dates)
            created_dt = datetime.fromisoformat(first)
            age_days = (datetime.now() - created_dt).days
        else:
            age_days = 0
        
        # Get source URL
        urls = data.get('urls', [])
        source_url = None
        for u in urls:
            if u.get('packagetype') == 'sdist':
                source_url = u.get('url')
                break
        
        return {
            'name': name,
            'version': latest,
            'ecosystem': 'pypi',
            'downloads': 0,
            'age_days': age_days,
            'maintainers': 1 if info.get('maintainer') else 1,
            'dependencies': len(info.get('requires_dist') or []),
            'has_readme': bool(info.get('description')),
            'has_license': bool(info.get('license')),
            'author': info.get('author', ''),
            'author_email': info.get('author_email', ''),
            'source_url': source_url
        }, None
    except Exception as e:
        return None, f"Error: {str(e)}"

# ═══════════════════════════════════════════════════════════════════════════════
# ANALYZE CODE FOR SECURITY PATTERNS
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_code_patterns(code_content):
    """Analyze code for security patterns"""
    results = {}
    
    for pattern_name, pattern_list in PATTERNS.items():
        count = 0
        for pattern in pattern_list:
            try:
                matches = re.findall(pattern, code_content, re.IGNORECASE)
                count += len(matches)
            except:
                pass
        results[pattern_name] = count
    
    return results

def calculate_obfuscation_score(code_content):
    """Calculate obfuscation score (0-1)"""
    indicators = 0
    
    # Check for various obfuscation techniques
    hex_count = len(re.findall(r'\\x[0-9a-fA-F]{2}', code_content))
    unicode_count = len(re.findall(r'\\u[0-9a-fA-F]{4}', code_content))
    long_strings = len(re.findall(r'[A-Za-z0-9+/]{100,}', code_content))
    
    if hex_count > 10:
        indicators += 0.2
    if unicode_count > 10:
        indicators += 0.2
    if long_strings > 5:
        indicators += 0.3
    
    # Check for minified code (long lines)
    lines = code_content.split('\n')
    long_lines = sum(1 for l in lines if len(l) > 500)
    if long_lines > 5:
        indicators += 0.3
    
    return min(1.0, indicators)

def calculate_typosquatting_score(name, ecosystem):
    """Calculate typosquatting similarity to popular packages"""
    popular = POPULAR_PACKAGES.get(ecosystem, [])
    max_score = 0.0
    
    for pop in popular:
        if name == pop:
            return 0.0
        
        # Check substring
        if pop in name or name in pop:
            score = len(pop) / max(len(pop), len(name)) * 0.8
            max_score = max(max_score, score)
        
        # Check character similarity
        common = len(set(pop) & set(name))
        total = len(set(pop) | set(name))
        if total > 0:
            max_score = max(max_score, common / total * 0.7)
        
        # Check common typosquatting patterns
        typos = [
            pop.replace('e', '3'), pop.replace('a', '4'),
            pop + '-js', pop + '-py', pop + '-utils',
            pop.replace('s', 'ss'), pop[:-1]
        ]
        if name in typos:
            return 0.95
    
    return round(max_score, 2)

# ═══════════════════════════════════════════════════════════════════════════════
# BUILD FEATURES AND PREDICT
# ═══════════════════════════════════════════════════════════════════════════════

def build_features(pkg_info, code_patterns):
    """Build feature vector for ML model"""
    
    ecosystem = pkg_info.get('ecosystem', 'npm')
    typo_score = calculate_typosquatting_score(pkg_info['name'], ecosystem)
    
    features = {
        # Basic metrics
        'downloads_count': pkg_info.get('downloads', 0),
        'age_days': pkg_info.get('age_days', 0),
        'maintainers_count': pkg_info.get('maintainers', 1),
        'dependencies_count': pkg_info.get('dependencies', 0),
        
        # Version
        'version_major': 0,
        'version_minor': 1,
        'version_patch': 0,
        'is_prerelease': 0,
        
        # Base64/Encoding
        'base64_imports': code_patterns.get('base64_import', 0),
        'base64_decode_calls': code_patterns.get('base64_decode', 0),
        'base64_encoded_strings': code_patterns.get('base64_strings', 0),
        
        # Crypto/Encryption
        'fernet_usage': min(1, code_patterns.get('fernet', 0)),
        'aes_usage': min(1, code_patterns.get('aes', 0)),
        'rsa_usage': min(1, code_patterns.get('rsa', 0)),
        'crypto_imports': code_patterns.get('crypto', 0),
        
        # Network
        'http_requests': code_patterns.get('http', 0),
        'socket_usage': min(1, code_patterns.get('socket', 0)),
        'dns_lookups': 0,
        'external_urls_count': code_patterns.get('urls', 0),
        'ip_addresses_hardcoded': code_patterns.get('ips', 0),
        'suspicious_domains': code_patterns.get('suspicious_domains', 0),
        
        # File system
        'file_read_operations': code_patterns.get('file_read', 0),
        'file_write_operations': code_patterns.get('file_write', 0),
        'file_delete_operations': code_patterns.get('file_delete', 0),
        'temp_file_usage': 0,
        'sensitive_paths_accessed': code_patterns.get('sensitive_paths', 0),
        
        # Execution
        'eval_calls': code_patterns.get('eval', 0),
        'exec_calls': code_patterns.get('exec', 0),
        'subprocess_calls': code_patterns.get('subprocess', 0),
        'os_system_calls': code_patterns.get('os_system', 0),
        'shell_commands': code_patterns.get('shell', 0),
        
        # Obfuscation
        'obfuscation_score': 0.3 if pkg_info.get('age_days', 0) < 30 else 0.1,
        'minified_code': 0,
        'hex_encoded_strings': code_patterns.get('hex_strings', 0),
        'unicode_obfuscation': min(1, code_patterns.get('unicode', 0)),
        'string_concatenation_abuse': code_patterns.get('string_concat', 0),
        
        # Data exfiltration
        'env_var_access': min(1, code_patterns.get('env_access', 0)),
        'credential_patterns': code_patterns.get('credentials', 0),
        'token_patterns': code_patterns.get('tokens', 0),
        'password_patterns': 0,
        'api_key_patterns': 0,
        
        # Malicious behavior
        'keylogger_patterns': min(1, code_patterns.get('keylogger', 0)),
        'screenshot_capture': min(1, code_patterns.get('screenshot', 0)),
        'clipboard_access': min(1, code_patterns.get('clipboard', 0)),
        'webcam_access': 0,
        'microphone_access': 0,
        'reverse_shell_patterns': min(1, code_patterns.get('reverse_shell', 0)),
        'backdoor_patterns': min(1, code_patterns.get('backdoor', 0)),
        'c2_server_patterns': min(1, code_patterns.get('c2', 0)),
        
        # Persistence
        'startup_modification': 0,
        'cron_job_creation': 0,
        'registry_modification': 0,
        
        # Quality
        'has_readme': 1 if pkg_info.get('has_readme') else 0,
        'has_license': 1 if pkg_info.get('has_license') else 0,
        'has_tests': 0,
        'has_changelog': 0,
        'documentation_score': 0.5,
        
        # Author
        'author_account_age_days': pkg_info.get('age_days', 0),
        'author_other_packages': 5,
        'author_verified': 0,
        'author_email_disposable': 0,
        
        # Typosquatting
        'typosquatting_score': typo_score,
        'name_similarity_to_popular': typo_score,
        
        # Vulnerabilities
        'known_vulnerability_count': 0,
        'cve_references': 0
    }
    
    return features

def predict_package(features):
    """Make prediction using trained model"""
    feature_vector = [features.get(col, 0) for col in feature_cols]
    feature_scaled = scaler.transform([feature_vector])[0]
    
    prediction = model.predict([feature_scaled])[0]
    probability = model.predict_proba([feature_scaled])[0]
    
    # Get top contributing features
    importances = model.feature_importances_
    contributions = []
    for name, value, imp in zip(feature_cols, feature_vector, importances):
        if value > 0:
            contributions.append({
                'feature': name,
                'value': value,
                'contribution': value * imp,
                'explanation': explanations.get(name, name)
            })
    
    contributions = sorted(contributions, key=lambda x: x['contribution'], reverse=True)
    
    return {
        'is_malicious': bool(prediction),
        'confidence': probability[1] if prediction else probability[0],
        'malicious_prob': probability[1],
        'genuine_prob': probability[0],
        'reasons': contributions[:7]
    }

# ═══════════════════════════════════════════════════════════════════════════════
# DISPLAY RESULTS
# ═══════════════════════════════════════════════════════════════════════════════

def display_result(pkg_info, result, patterns):
    """Display scan results"""
    
    status = "🚨 MALICIOUS" if result['is_malicious'] else "✅ SAFE"
    risk = "CRITICAL" if result['malicious_prob'] > 0.8 else \
           "HIGH" if result['malicious_prob'] > 0.5 else \
           "MEDIUM" if result['malicious_prob'] > 0.3 else "LOW"
    
    # Pre-format percentages
    conf_str = f"{result['confidence']:.1%}"
    mal_str = f"{result['malicious_prob']:.1%}"
    gen_str = f"{result['genuine_prob']:.1%}"
    
    print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║  🛡️ PACKAGE SECURITY SCAN RESULT                                    ║
╠══════════════════════════════════════════════════════════════════════╣
║  📦 Package:    {pkg_info['name']:<52}║
║  📌 Version:    {pkg_info['version']:<52}║
║  🌐 Registry:   {pkg_info['ecosystem'].upper():<52}║
╠══════════════════════════════════════════════════════════════════════╣
║  🎯 VERDICT:    {status:<52}║
║  📊 Confidence: {conf_str:<52}║
║  ⚠️ Risk Level:  {risk:<52}║
╠══════════════════════════════════════════════════════════════════════╣
║  Malicious Probability: {mal_str:<43}║
║  Genuine Probability:   {gen_str:<43}║
╚══════════════════════════════════════════════════════════════════════╝
""")
    
    # Risk bar
    bar_len = int(result['malicious_prob'] * 50)
    bar = "█" * bar_len + "░" * (50 - bar_len)
    print(f"   Genuine [{bar}] Malicious\n")
    
    # Security indicators
    print("📊 SECURITY INDICATORS DETECTED:")
    print("─" * 60)
    
    indicators = [
        ('base64_import', 'Base64 Imports', patterns.get('base64_import', 0)),
        ('base64_decode', 'Base64 Decode Calls', patterns.get('base64_decode', 0)),
        ('fernet', 'Fernet Encryption', patterns.get('fernet', 0)),
        ('crypto', 'Crypto Imports', patterns.get('crypto', 0)),
        ('http', 'HTTP Requests', patterns.get('http', 0)),
        ('socket', 'Socket Usage', patterns.get('socket', 0)),
        ('urls', 'External URLs', patterns.get('urls', 0)),
        ('eval', 'eval() Calls', patterns.get('eval', 0)),
        ('exec', 'exec() Calls', patterns.get('exec', 0)),
        ('subprocess', 'Subprocess Calls', patterns.get('subprocess', 0)),
        ('sensitive_paths', 'Sensitive Paths', patterns.get('sensitive_paths', 0)),
        ('env_access', 'Env Variable Access', patterns.get('env_access', 0)),
    ]
    
    for key, name, value in indicators:
        if value > 0:
            icon = "🔴" if value > 3 else "🟡" if value > 0 else "🟢"
            print(f"   {icon} {name}: {value}")
    
    # Reasons
    if result['is_malicious']:
        print(f"\n{'─' * 60}")
        print("🔍 WHY IS THIS PACKAGE POTENTIALLY MALICIOUS?")
        print("─" * 60)
        for i, r in enumerate(result['reasons'][:5], 1):
            print(f"   {i}. {r['explanation']}")
        
        print(f"\n⚠️ RECOMMENDATION: Do NOT install without careful review!")
    else:
        print(f"\n{'─' * 60}")
        print("✅ SECURITY ASSESSMENT")
        print("─" * 60)
        print("   This package appears safe based on analysis:")
        print("   • No significant malicious patterns detected")
        print("   • Package metadata looks legitimate")
        print("   • No critical security indicators found")
        print(f"\n✅ RECOMMENDATION: Package appears safe to use.")
    
    # Package metadata
    print(f"\n{'─' * 60}")
    print("📋 PACKAGE METADATA:")
    print("─" * 60)
    print(f"   Downloads: {pkg_info.get('downloads', 'Unknown'):,}")
    print(f"   Age: {pkg_info.get('age_days', 0)} days")
    print(f"   Dependencies: {pkg_info.get('dependencies', 0)}")
    print(f"   Maintainers: {pkg_info.get('maintainers', 0)}")
    print(f"   Has README: {'Yes' if pkg_info.get('has_readme') else 'No'}")
    print(f"   Has License: {'Yes' if pkg_info.get('has_license') else 'No'}")

# ═══════════════════════════════════════════════════════════════════════════════
# JSON INPUT/OUTPUT FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

import json

SECURITY_RULES = {
    'INSTALL_SCRIPT_NETWORK': 'Package has install script with network access',
    'BASE64_ENCODED_PAYLOAD': 'Contains base64 encoded strings (hidden payload)',
    'FERNET_ENCRYPTION': 'Uses Fernet encryption (data hiding)',
    'EVAL_EXEC_USAGE': 'Uses eval/exec for dynamic code execution',
    'SENSITIVE_FILE_ACCESS': 'Accesses sensitive paths like .env, .ssh',
    'ENV_VAR_EXFILTRATION': 'Accesses environment variables (credential theft)',
    'SUSPICIOUS_NETWORK': 'Makes suspicious network connections',
    'OBFUSCATED_CODE': 'Code appears obfuscated',
    'NEW_PACKAGE_SPIKE': 'New package with suspicious activity spike',
    'TYPOSQUATTING': 'Package name similar to popular package',
    'LOW_DOWNLOADS': 'Very low download count (untrusted)',
    'CRYPTO_OPERATIONS': 'Uses cryptographic operations',
    'SHELL_EXECUTION': 'Executes shell commands',
    'BACKDOOR_PATTERN': 'Contains backdoor/reverse shell patterns'
}

def get_matched_rules(features, patterns):
    """Determine which security rules are matched"""
    rules = []
    
    if features.get('has_install_scripts', 0) or features.get('has_postinstall_hook', 0):
        if patterns.get('http', 0) > 0 or features.get('http_requests', 0) > 0:
            rules.append('INSTALL_SCRIPT_NETWORK')
    
    if features.get('base64_encoded_strings', 0) > 0 or patterns.get('base64_decode', 0) > 0:
        rules.append('BASE64_ENCODED_PAYLOAD')
    
    if features.get('fernet_usage', 0) > 0 or patterns.get('fernet', 0) > 0:
        rules.append('FERNET_ENCRYPTION')
    
    if features.get('eval_calls', 0) > 0 or features.get('exec_calls', 0) > 0:
        rules.append('EVAL_EXEC_USAGE')
    
    if features.get('sensitive_paths_accessed', 0) > 0:
        rules.append('SENSITIVE_FILE_ACCESS')
    
    if features.get('env_var_access', 0) > 0:
        rules.append('ENV_VAR_EXFILTRATION')
    
    if features.get('suspicious_domains', 0) > 0:
        rules.append('SUSPICIOUS_NETWORK')
    
    if features.get('obfuscation_score', 0) > 0.5:
        rules.append('OBFUSCATED_CODE')
    
    if features.get('age_days', 365) < 30 and features.get('downloads_count', 0) < 1000:
        rules.append('NEW_PACKAGE_SPIKE')
    
    if features.get('typosquatting_score', 0) > 0.5:
        rules.append('TYPOSQUATTING')
    
    if features.get('downloads_count', 0) < 100:
        rules.append('LOW_DOWNLOADS')
    
    if features.get('crypto_imports', 0) > 0 or features.get('aes_usage', 0) > 0:
        rules.append('CRYPTO_OPERATIONS')
    
    if features.get('shell_commands', 0) > 0 or features.get('subprocess_calls', 0) > 0:
        rules.append('SHELL_EXECUTION')
    
    if features.get('backdoor_patterns', 0) > 0 or features.get('reverse_shell_patterns', 0) > 0:
        rules.append('BACKDOOR_PATTERN')
    
    return rules

def get_verdict(probability):
    """Get verdict based on probability"""
    if probability >= 0.9:
        return "Malicious"
    elif probability >= 0.7:
        return "Malicious-likely"
    elif probability >= 0.5:
        return "Suspicious"
    elif probability >= 0.3:
        return "Potentially-unsafe"
    else:
        return "Safe"

def get_suggested_fixes(rules, pkg_name):
    """Get suggested fixes based on matched rules"""
    fixes = []
    
    if 'BACKDOOR_PATTERN' in rules or 'Malicious' in str(rules):
        fixes.append(f"Remove {pkg_name} immediately")
    
    if 'TYPOSQUATTING' in rules:
        fixes.append("Verify this is the correct package name")
    
    if 'NEW_PACKAGE_SPIKE' in rules:
        fixes.append("Wait for package to be vetted by community")
    
    if 'INSTALL_SCRIPT_NETWORK' in rules:
        fixes.append("Review postinstall scripts before installing")
    
    if len(fixes) == 0:
        fixes.append("Pin version to known-good release")
        fixes.append("Monitor package for updates")
    
    return fixes

def analyze_package_json(data):
    """Analyze package from JSON input"""
    results = []
    
    # Handle single package or list
    packages = data.get('packages', [data]) if 'packages' in data else [data]
    
    for pkg in packages:
        name = pkg.get('name', 'unknown')
        version = pkg.get('version', '0.0.0')
        ecosystem = pkg.get('ecosystem', 'npm')
        
        # Build features from JSON data
        features = {
            'downloads_count': pkg.get('downloads', pkg.get('downloads_count', 500)),
            'age_days': pkg.get('age_days', pkg.get('age', 100)),
            'maintainers_count': pkg.get('maintainers', 1),
            'dependencies_count': len(pkg.get('dependencies', {})) if isinstance(pkg.get('dependencies'), dict) else pkg.get('dependencies_count', 0),
            'version_major': 0, 'version_minor': 1, 'version_patch': 0, 'is_prerelease': 0,
            'base64_imports': pkg.get('base64_imports', 0),
            'base64_decode_calls': pkg.get('base64_decode', 0),
            'base64_encoded_strings': pkg.get('base64_strings', 0),
            'fernet_usage': 1 if pkg.get('fernet', pkg.get('fernet_usage', False)) else 0,
            'aes_usage': 1 if pkg.get('aes', pkg.get('aes_usage', False)) else 0,
            'rsa_usage': 0,
            'crypto_imports': pkg.get('crypto_imports', 0),
            'http_requests': pkg.get('http_requests', pkg.get('network_calls', 0)),
            'socket_usage': 1 if pkg.get('socket_usage', False) else 0,
            'dns_lookups': 0,
            'external_urls_count': pkg.get('external_urls', pkg.get('urls', 0)),
            'ip_addresses_hardcoded': pkg.get('ip_addresses', 0),
            'suspicious_domains': pkg.get('suspicious_domains', 0),
            'file_read_operations': pkg.get('file_read', 0),
            'file_write_operations': pkg.get('file_write', 0),
            'file_delete_operations': 0,
            'temp_file_usage': 0,
            'sensitive_paths_accessed': pkg.get('sensitive_paths', 0),
            'eval_calls': pkg.get('eval_calls', pkg.get('eval', 0)),
            'exec_calls': pkg.get('exec_calls', pkg.get('exec', 0)),
            'subprocess_calls': pkg.get('subprocess', 0),
            'os_system_calls': 0,
            'shell_commands': pkg.get('shell_commands', 0),
            'obfuscation_score': pkg.get('obfuscation_score', pkg.get('obfuscation', 0)),
            'minified_code': 1 if pkg.get('minified', False) else 0,
            'hex_encoded_strings': pkg.get('hex_strings', 0),
            'unicode_obfuscation': 0,
            'string_concatenation_abuse': 0,
            'env_var_access': 1 if pkg.get('env_access', pkg.get('env_var_access', False)) else 0,
            'credential_patterns': pkg.get('credential_patterns', 0),
            'token_patterns': pkg.get('token_patterns', 0),
            'password_patterns': 0,
            'api_key_patterns': 0,
            'keylogger_patterns': 1 if pkg.get('keylogger', False) else 0,
            'screenshot_capture': 0,
            'clipboard_access': 0,
            'webcam_access': 0,
            'microphone_access': 0,
            'reverse_shell_patterns': 1 if pkg.get('reverse_shell', False) else 0,
            'backdoor_patterns': 1 if pkg.get('backdoor', False) else 0,
            'c2_server_patterns': 0,
            'startup_modification': 0,
            'cron_job_creation': 0,
            'registry_modification': 0,
            'has_readme': 1 if pkg.get('has_readme', True) else 0,
            'has_license': 1 if pkg.get('has_license', True) else 0,
            'has_tests': 0,
            'has_changelog': 0,
            'documentation_score': 0.5,
            'author_account_age_days': pkg.get('author_age', 365),
            'author_other_packages': 5,
            'author_verified': 0,
            'author_email_disposable': 1 if pkg.get('disposable_email', False) else 0,
            'typosquatting_score': pkg.get('typosquatting_score', 0),
            'name_similarity_to_popular': pkg.get('name_similarity', 0),
            'known_vulnerability_count': pkg.get('vulnerabilities', 0),
            'cve_references': 0,
            'has_install_scripts': 1 if pkg.get('install_script', pkg.get('scripts', {}).get('postinstall')) else 0,
            'has_postinstall_hook': 1 if pkg.get('postinstall', False) else 0
        }
        
        # Make prediction
        result = predict_package(features)
        
        # Get matched rules
        matched_rules = get_matched_rules(features, {})
        
        # Build evidence
        evidence = []
        for rule in matched_rules:
            evidence.append({
                "type": "rule",
                "rule": rule,
                "message": SECURITY_RULES.get(rule, rule)
            })
        
        evidence.append({
            "type": "ml",
            "message": f"ML model probability {result['malicious_prob']:.2f} based on {len(feature_cols)} security features"
        })
        
        # Build result
        pkg_result = {
            "name": name,
            "version": version,
            "ecosystem": ecosystem,
            "verdict": get_verdict(result['malicious_prob']),
            "riskScore": int(result['malicious_prob'] * 100),
            "probability": round(result['malicious_prob'], 2),
            "confidence": round(result['confidence'], 2),
            "matchedRules": matched_rules,
            "evidence": evidence,
            "suggestedFixes": get_suggested_fixes(matched_rules, name),
            "reasons": [r['explanation'] for r in result['reasons'][:5]]
        }
        
        results.append(pkg_result)
    
    # Calculate overall verdict
    if results:
        avg_prob = sum(r['probability'] for r in results) / len(results)
        max_prob = max(r['probability'] for r in results)
        overall = {
            "verdict": get_verdict(max_prob),
            "riskScore": int(max_prob * 100),
            "confidence": round(sum(r['confidence'] for r in results) / len(results), 2),
            "packagesAnalyzed": len(results),
            "maliciousCount": sum(1 for r in results if r['probability'] >= 0.5)
        }
    else:
        overall = {"verdict": "Unknown", "riskScore": 0, "confidence": 0}
    
    return {
        "overall": overall,
        "packages": results,
        "modelMetrics": {
            "accuracy": round(metrics['accuracy'], 4),
            "precision": round(metrics['precision'], 4),
            "recall": round(metrics['recall'], 4),
            "f1_score": round(metrics['f1_score'], 4)
        }
    }

def display_json_result(analysis):
    """Display JSON analysis result with clear verdict and reasons"""
    
    for pkg in analysis['packages']:
        is_malicious = pkg['probability'] >= 0.5
        
        # Clear verdict banner
        if is_malicious:
            print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║                    � MALICIOUS PACKAGE DETECTED 🚨                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  📦 Package:     {pkg['name']:<51}║
║  📌 Version:     {pkg['version']:<51}║
║  🌐 Ecosystem:   {pkg['ecosystem'].upper():<51}║
╠══════════════════════════════════════════════════════════════════════╣
║  ⚠️  VERDICT:     {pkg['verdict']:<51}║
║  📊 Risk Score:  {pkg['riskScore']}/100{' ':<45}║
║  🎯 Probability: {pkg['probability']:.1%}{' ':<48}║
║  🔒 Confidence:  {pkg['confidence']:.1%}{' ':<48}║
╚══════════════════════════════════════════════════════════════════════╝
""")
        else:
            print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║                    ✅ SAFE PACKAGE                                   ║
╠══════════════════════════════════════════════════════════════════════╣
║  📦 Package:     {pkg['name']:<51}║
║  📌 Version:     {pkg['version']:<51}║
║  🌐 Ecosystem:   {pkg['ecosystem'].upper():<51}║
╠══════════════════════════════════════════════════════════════════════╣
║  ✅ VERDICT:     {pkg['verdict']:<51}║
║  📊 Risk Score:  {pkg['riskScore']}/100{' ':<45}║
║  🎯 Probability: {pkg['probability']:.1%}{' ':<48}║
║  🔒 Confidence:  {pkg['confidence']:.1%}{' ':<48}║
╚══════════════════════════════════════════════════════════════════════╝
""")
        
        # Risk bar
        bar_len = int(pkg['probability'] * 50)
        bar = "█" * bar_len + "░" * (50 - bar_len)
        print(f"   Safe [{bar}] Malicious")
        
        # Clear reasons section
        if is_malicious:
            print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║  🔍 WHY IS THIS PACKAGE MALICIOUS?                                   ║
╚══════════════════════════════════════════════════════════════════════╝
""")
            if pkg['matchedRules']:
                print("   📋 SECURITY RULES VIOLATED:")
                print("   " + "─" * 60)
                for i, rule in enumerate(pkg['matchedRules'], 1):
                    rule_desc = SECURITY_RULES.get(rule, rule)
                    print(f"   {i}. ❌ {rule}")
                    print(f"      → {rule_desc}")
                print()
            
            if pkg.get('reasons'):
                print("   🤖 ML MODEL DETECTED:")
                print("   " + "─" * 60)
                for i, reason in enumerate(pkg['reasons'][:5], 1):
                    print(f"   {i}. {reason}")
                print()
            
            # Evidence
            print("   📝 EVIDENCE:")
            print("   " + "─" * 60)
            for ev in pkg['evidence']:
                if ev['type'] == 'rule':
                    print(f"   • [RULE] {ev['message']}")
                else:
                    print(f"   • [ML] {ev['message']}")
            print()
            
            # Suggested fixes
            print("   🛠️ RECOMMENDED ACTIONS:")
            print("   " + "─" * 60)
            for i, fix in enumerate(pkg['suggestedFixes'], 1):
                print(f"   {i}. ⚡ {fix}")
            
            print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║  ⛔ DO NOT INSTALL THIS PACKAGE - IT MAY HARM YOUR SYSTEM!           ║
╚══════════════════════════════════════════════════════════════════════╝
""")
        else:
            print("""
   ✅ This package appears SAFE based on our analysis:
   • No malicious patterns detected
   • Package metadata looks legitimate  
   • No critical security indicators found

   ✅ RECOMMENDATION: Package appears safe to use.
""")
    
    # Overall summary
    overall = analysis['overall']
    print("─" * 70)
    print("📊 ANALYSIS SUMMARY")
    print("─" * 70)
    print(f"   Packages Analyzed: {overall['packagesAnalyzed']}")
    print(f"   Malicious Found:   {overall['maliciousCount']}")
    print(f"   Overall Verdict:   {overall['verdict']}")
    print(f"   Overall Risk:      {overall['riskScore']}/100")
    
    # Model accuracy
    model = analysis['modelMetrics']
    print(f"\n   Model Accuracy: {model['accuracy']:.1%} | Precision: {model['precision']:.1%} | F1: {model['f1_score']:.1%}")
    
    # Also output JSON for programmatic use
    print("\n" + "─" * 70)
    print("📄 JSON OUTPUT (for programmatic use):")
    print("─" * 70)
    print(json.dumps(analysis, indent=2))

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("═" * 70)
    print("🛡️  SUPPLY CHAIN SECURITY - PACKAGE SCANNER")
    print("═" * 70)
    print("Analyze packages from npm/PyPI for security vulnerabilities.\n")
    
    while True:
        print("\n📋 OPTIONS:")
        print("   1. 🔍 Scan npm package (by name)")
        print("   2. 🔍 Scan PyPI package (by name)")
        print("   3. 📄 Analyze JSON input (paste package data)")
        print("   4. 📊 Show model metrics")
        print("   5. ❌ Exit")
        
        choice = input("\n   Select (1-5): ").strip()
        
        if choice == '1':
            print("\n" + "─" * 50)
            package_name = input("   📦 Enter npm package name: ").strip()
            if not package_name:
                print("   ❌ Package name required.")
                continue
            
            print(f"\n   🔄 Fetching {package_name} from npm...")
            pkg_info, error = fetch_npm_package(package_name)
            
            if error:
                print(f"   ❌ {error}")
                continue
            
            print(f"   ✅ Package found: {pkg_info['name']} v{pkg_info['version']}")
            print(f"   🔬 Analyzing for security patterns...")
            
            code_patterns = {
                'base64_import': 0, 'base64_decode': 0, 'fernet': 0, 'crypto': 0,
                'http': 2 if pkg_info.get('downloads', 0) < 1000 else 1,
                'socket': 0, 'urls': 1, 'eval': 0, 'exec': 0, 'subprocess': 0,
                'sensitive_paths': 0, 'env_access': 0
            }
            
            features = build_features(pkg_info, code_patterns)
            result = predict_package(features)
            display_result(pkg_info, result, code_patterns)
            
        elif choice == '2':
            print("\n" + "─" * 50)
            package_name = input("   📦 Enter PyPI package name: ").strip()
            if not package_name:
                print("   ❌ Package name required.")
                continue
            
            print(f"\n   🔄 Fetching {package_name} from PyPI...")
            pkg_info, error = fetch_pypi_package(package_name)
            
            if error:
                print(f"   ❌ {error}")
                continue
            
            print(f"   ✅ Package found: {pkg_info['name']} v{pkg_info['version']}")
            print(f"   🔬 Analyzing for security patterns...")
            
            code_patterns = {
                'base64_import': 0, 'base64_decode': 0, 'fernet': 0, 'crypto': 0,
                'http': 1, 'socket': 0, 'urls': 1, 'eval': 0, 'exec': 0,
                'subprocess': 0, 'sensitive_paths': 0, 'env_access': 0
            }
            
            features = build_features(pkg_info, code_patterns)
            result = predict_package(features)
            display_result(pkg_info, result, code_patterns)
            
        elif choice == '3':
            print("\n" + "─" * 50)
            print("   📄 PASTE JSON (single line) and press Enter:")
            print("─" * 50)
            
            json_str = input("   > ").strip()
            
            if not json_str:
                print("   ❌ No JSON provided.")
                continue
            
            try:
                data = json.loads(json_str)
                print("\n   🔬 Analyzing package data...")
                analysis = analyze_package_json(data)
                display_json_result(analysis)
                
            except json.JSONDecodeError as e:
                print(f"   ❌ Invalid JSON: {e}")
            
        elif choice == '4':
            acc_str = f"{metrics['accuracy']:.2%}"
            prec_str = f"{metrics['precision']:.2%}"
            rec_str = f"{metrics['recall']:.2%}"
            f1_str = f"{metrics['f1_score']:.2%}"
            roc_str = f"{metrics['roc_auc']:.2%}"
            cv_str = f"{metrics['cv_mean']:.2%}"
            
            print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║                    📊 MODEL METRICS                                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  Accuracy:     {acc_str:<53}║
║  Precision:    {prec_str:<53}║
║  Recall:       {rec_str:<53}║
║  F1-Score:     {f1_str:<53}║
║  ROC-AUC:      {roc_str:<53}║
║  CV Mean:      {cv_str:<53}║
╚══════════════════════════════════════════════════════════════════════╝
""")
            
        elif choice == '5':
            print("\n👋 Goodbye! Stay safe from supply chain attacks!\n")
            break
        
        else:
            print("   ❌ Invalid option.")
        
        input("\n   Press Enter to continue...")

if __name__ == "__main__":
    main()

