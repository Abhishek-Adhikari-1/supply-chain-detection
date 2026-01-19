# Supply Chain Guardian

AI-Powered Package Security Analysis Platform for detecting malicious supply chain attacks in npm/PyPI packages.

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+
- MongoDB
- Docker (for sandbox testing)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env if backend runs on different port
npm run dev
```

### Train ML Model

```bash
python train_model.py
```

### Run Sandbox Tests

```bash
cd sandbox
bash test_all.sh
```

## Features

- 🤖 AI-powered malicious package detection
- 🔍 Real-time code analysis
- 🛡️ Automated threat blocking
- 📊 Risk scoring and detailed reports
- 🐳 Isolated sandbox execution
- 📈 Security dashboard

## Architecture

```text
Frontend (React) → Backend (Express) → AI/ML (Python) + Sandbox (Docker)
```

See [README.md](README.md) for complete documentation.
