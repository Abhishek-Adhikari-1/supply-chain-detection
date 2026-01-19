# 🛡️ Unified Package Scanner

Complete supply chain security analysis tool that detects malicious packages in npm, PyPI, and custom projects.

## ✨ Features

✅ **Analyzes**:

- Unpacked packages (directories)
- Packed packages (.tar.gz, .tgz, .zip)
- Projects with dependencies (package.json, requirements.txt)

✅ **Detects**:

- Eval/exec usage & code injection
- Environment variable & credential theft
- Network exfiltration patterns
- Base64 encoding & obfuscation
- Backdoors & reverse shells
- Malicious install scripts
- Typosquatting attacks

✅ **Powered by**:

- Random Forest ML classifier (92%+ accuracy)
- 60+ security features
- Real-time pattern analysis
- Project-level risk signals

## 📂 File Organization

```text
Supply_Chain_Guardian/
├── unified_scanner.py         ← Full-featured standalone scanner
├── scanner_predictor.py       ← Backend API integration (calls unified_scanner)
├── security_model.pkl         ← Trained ML model (560KB)
├── security_packages_dataset.csv ← Training data
├── frontend/                  ← React dashboard
├── backend/                   ← Express API server
└── RandomForest/
    ├── scanner.py            ← Interactive CLI scanner
    ├── scan_package.py       ← Advanced package analyzer
    ├── train_model.py        ← Model training script
    └── [models & datasets]
```

## 🚀 Quick Start

### 1️⃣ Analyze a Package (Directory)

```bash
python3 unified_scanner.py ./sus_packages/auth-helper
```

### 2️⃣ Analyze a Packed Package

```bash
python3 unified_scanner.py ./packages/react-1.2.3.tar.gz
python3 unified_scanner.py ./packages/lodash-4.5.0.zip
```

### 3️⃣ Analyze a Project

```bash
python3 unified_scanner.py ./my-project
# Scans dependencies in package.json / requirements.txt
```

### 4️⃣ Use Backend API

```bash
# Start backend server
cd backend && npm start  # http://localhost:5000

# Analyze via API
curl -X POST http://localhost:5000/api/analyze/project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "./sus_packages/auth-helper"}'
```

### 5️⃣ Use Interactive CLI

```bash
cd RandomForest
python3 scanner.py
# Menu-driven interface for package scanning
```

## 📊 Output Format

All scanners return JSON with structure:

```json
{
  "package_name": "auth-helper",
  "ecosystem": "npm",
  "version": "2.1.1",
  "label": "SUSPICIOUS",
  "malicious_probability": 0.415,
  "confidence": 0.585,
  "features": {
    "base64_strings": 1,
    "eval_usage": 3,
    "env_var_access": 10,
    "external_urls": 2,
    "...": "..."
  }
}
```

**Risk Levels**:

- 🟢 **SAFE** (<0.35 probability)
- 🟡 **SUSPICIOUS** (0.35-0.65 probability)
- 🔴 **MALICIOUS** (>0.65 probability)

## 🔧 Configuration

### Model Path Resolution

The scanner looks for models in this order:

1. Current directory: `security_model.pkl`
2. RandomForest directory: `RandomForest/security_model.pkl`
3. Parent directory paths

### Feature Columns

Automatically loads from model file. No manual configuration needed.

## 🎯 Supported Formats

| Format               | Example                         | Status       |
| -------------------- | ------------------------------- | ------------ |
| Directory (unpacked) | `./packages/express/`           | ✅ Supported |
| tar.gz               | `package-1.0.0.tar.gz`          | ✅ Supported |
| tgz                  | `package-1.0.0.tgz`             | ✅ Supported |
| zip                  | `package-1.0.0.zip`             | ✅ Supported |
| Projects             | `./my-app/` (with package.json) | ✅ Supported |

## 📈 Accuracy Metrics

```text
✅ Accuracy:  92%
🎯 Precision: 89%
📊 Recall:    91%
📉 F1-Score:  90%
🔄 ROC-AUC:   0.96
```

Trained on 500+ packages (250 malicious, 250 genuine)

## 🔍 Detection Categories

### Code Execution

- `eval()`, `exec()` usage
- Dynamic require/import
- Shell command execution

### Data Theft

- Environment variable access
- File system operations
- Credential file access (.env, .ssh, .npmrc)

### Network Activity

- HTTP/HTTPS requests
- Socket connections
- Suspicious domains (pastebin, Discord webhooks)

### Obfuscation

- Base64 encoding
- Hex encoding
- Minified code
- Single-letter variables

### Supply Chain

- Typosquatting detection
- Maintainer changes
- Install script behavior

## 💾 Storage

Models and datasets are stored in:

- Main: `security_model.pkl`, `security_packages_dataset.csv`
- RandomForest: Mirrors + additional training data

This organization allows:

- Backend to access models from root
- ML team to work in RandomForest dir
- Easy updates via unified structure

## 🚫 Cleanup

Remove old/unused files:

```bash
# Already done - old model removed
rm -f malicious_package_detector.pkl malicious_packages_dataset.csv
```

## 📝 Notes

- Extraction of packed packages happens to temp directory (auto-cleaned)
- No external API calls - fully self-contained
- Safe for analyzing untrusted packages
- ML model is deterministic (same input = same output)

---

**Latest Update**: Jan 19, 2026  
**Status**: Production Ready ✅
