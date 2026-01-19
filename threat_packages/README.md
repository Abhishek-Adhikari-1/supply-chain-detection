⚠️ **MALICIOUS PACKAGES - EDUCATIONAL DEMO ONLY** ⚠️

This directory contains three sample malicious packages created for the Supply Chain Guardian hackathon. These packages demonstrate real attack vectors and are designed to be DETECTED by the security system.

**DO NOT INSTALL OR USE THESE IN PRODUCTION ENVIRONMENTS**

---

## Package 1: Data Exfiltration Attack

**Name:** `auth-helper` v2.1.1  
**Type:** Credential Theft  
**Attack Vector:** Post-install Hook

### What it does:
- Steals environment variables (API keys, tokens, secrets)
- Reads sensitive files (~/.ssh/id_rsa, ~/.npmrc, ~/.gitconfig)
- Sends stolen data to attacker server (45.142.212.61:8080)
- Uses obfuscation (base64 encoding, eval) to hide intent
- Creates persistence via cron job

### Detection Signals:
- ✅ Network calls to external IP (45.142.212.61)
- ✅ Access to environment variables via process.env
- ✅ Use of eval() for code execution
- ✅ File operations on sensitive paths
- ✅ Base64 obfuscation detected
- ✅ Postinstall hook execution
- ✅ Maintainer changed recently

### Files:
- `package.json` - Normal package metadata
- `index.js` - Main malicious code with legitimate API
- `setup.js` - Runs on npm install, creates persistence

---

## Package 2: Reverse Shell Backdoor

**Name:** `util-common` v1.3.4  
**Type:** Remote Code Execution  
**Attack Vector:** Direct code execution on import

### What it does:
- Creates reverse shell connection to attacker (192.168.1.100:4444)
- Allows attacker to execute arbitrary commands
- Auto-reconnects every 30 seconds if connection drops
- Uses eval() and indirect function calls to evade detection
- Runs silently in background

### Detection Signals:
- ✅ Network connections via net.createConnection()
- ✅ Use of child_process.exec() for arbitrary command execution
- ✅ eval() with function serialization
- ✅ Auto-reconnection logic (suspicious timing)
- ✅ No legitimate use of network sockets in utility library
- ✅ Suspicious author email (hacker@suspicious.dev)

### Files:
- `package.json` - Legitimate-looking package
- `index.js` - Backdoor class with normal utilities mixed in

---

## Package 3: Cryptocurrency Miner

**Name:** `crypto-boost` v0.9.8  
**Type:** Resource Hijacking  
**Attack Vector:** CPU exhaustion via worker threads

### What it does:
- Launches mining worker threads on all available CPU cores
- Mines cryptocurrency (Monero-like using SHA256)
- Uses obfuscation to hide wallet address (hex encoding)
- Reports stats every 60 seconds
- Runs silently, consuming CPU quietly

### Detection Signals:
- ✅ Excessive use of worker_threads
- ✅ CPU-intensive hashing operations
- ✅ Hex-encoded obfuscation of wallet address
- ✅ Suspicious pool URLs hardcoded
- ✅ Periodic reporting mechanism (60s interval)
- ✅ Unexpected author origin (mining.pool.ru)
- ✅ Large code change for "crypto utilities"

---

## How the Security System Detects These

### Feature Extraction Analysis:

1. **Code Comparison**
   - Compare old vs new version AST
   - Identify new code blocks (backdoor, miner)
   - Calculate change percentage

2. **Network Analysis**
   - Detect external IP addresses (45.142.212.61)
   - Identify socket connections
   - Check for suspicious domains

3. **File Operations**
   - Track file read/write attempts
   - Check for sensitive file access
   - Monitor postinstall hooks

4. **Obfuscation Detection**
   - Base64 encoding detection
   - Hex string patterns
   - eval() / exec() usage
   - Single-letter variable names

5. **Dangerous Function Detection**
   - eval(), exec(), __import__()
   - child_process operations
   - reverse shell patterns

6. **Environment Access**
   - process.env reads
   - os.environ access
   - Credential file access

7. **Metadata Analysis**
   - Maintainer change detection
   - New suspicious dependencies
   - Author email reputation

### Risk Scoring:

```
Package 1 (Exfiltration):    96/100 ⚠️ CRITICAL
Package 2 (Backdoor):         94/100 ⚠️ CRITICAL
Package 3 (Cryptominer):      88/100 ⚠️ CRITICAL
```

All three should be automatically blocked by the AI system.

---

## Usage in Demo

### Terminal Output:
```bash
$ npm install util-common@1.3.4

⚠️  Supply Chain Guardian: Analyzing dependencies...

🚨 util-common@1.3.4 - BLOCKED (score: 94/100)

❌ Installation blocked due to security threat!

Threat: Reverse shell backdoor detected
Details: http://localhost:3000/threat/xyz789

Behaviors detected:
  • Remote command execution capability
  • Auto-reconnection to 192.168.1.100:4444
  • Indirect eval() execution
  • No legitimate use case for these functions
```

### Dashboard:
Shows threat reports for each package with:
- Side-by-side code comparison
- Risk score breakdown
- Detection rules that triggered
- Recommended actions

---

## Educational Value

These packages demonstrate:
1. **Real attack patterns** used in the wild
2. **Obfuscation techniques** attackers employ
3. **How mixing legitimate and malicious code** evades simple scanners
4. **Post-install hooks** as attack vector
5. **Why supply chain security** is critical

---

## For Hackathon Judges

These packages are:
- ✅ Intentionally malicious (to demonstrate threats)
- ✅ Non-functional (won't actually harm systems)
- ✅ Clearly marked as educational
- ✅ Used to showcase detection capabilities
- ✅ Safe to examine in controlled environments

---

**Created:** January 19, 2026  
**Purpose:** Supply Chain Guardian Hackathon Demo  
**Status:** Educational Demo Only
