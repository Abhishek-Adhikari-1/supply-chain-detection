# Hacking Team Playbook (Demo Packages)

Purpose: Provide safe, reproducible “malicious” demo packages to validate Supply Chain Guardian’s detectors. These are intentionally suspicious and gated to avoid auto-execution.

Safety Rules

- Do not execute payloads unless explicitly required for a demo.
- All runtime code is gated by `RUN_DEMO=1`.
- Use loopback/isolated networks when running anything. For static analysis, execution is unnecessary.

Packages

- auth-helper (Node):
  - Signals: env access, base64, eval/Function, file write/remove, HTTP POST to `45.142.212.61`.
  - Files: sus_packages/auth-helper/index.js, package.json (maintainer changed, suspicious dep `crypto-stealer`).
- crypto-miner (Node):
  - Signals: CPU spin, obfuscated base64 string, suspicious dep `xmrig-native`.
  - Files: sus_packages/crypto-miner/index.js, package.json.
- py_backdoor (Python):
  - Signals: env access, `~/.ssh/id_rsa` read (first bytes), socket connect to `45.142.212.61:443`, base64+exec.
  - Files: sus_packages/py_backdoor/backdoor.py, **init**.py.

Static Analysis (preferred)

- No execution needed; detectors scan source for patterns.
- Quick checks:
  - Look for: external IPs, `process.env`/`os.environ`, `eval`/`exec`, base64 blobs, file ops, suspicious deps.

Optional Runtime Demos (guarded)

- Node (only if needed):

  ```bash
  # Safe import (no run)
  node -e "require('./sus_packages/auth-helper')"

  # Gated run
  RUN_DEMO=1 node sus_packages/auth-helper/index.js
  RUN_DEMO=1 node sus_packages/crypto-miner/index.js
  ```

- Python (only if needed):

  ```bash
  python -c "import sus_packages.py_backdoor as p; print('loaded')"
  RUN_DEMO=1 python -c "import sus_packages.py_backdoor as p; p.exfiltrate()"
  ```

Integration With Pipeline

- Simulate detection loop:

  ```bash
  python backend/monitor.py --package auth-helper --old-version 2.1.0 --new-version 2.1.1
  ```

- Feature extraction only:

  ```bash
  python ai/feature_extractor.py --package-path sus_packages/auth-helper
  ```

- Model prediction sample:

  ```bash
  python ai/model.py --predict --features "[3,2,45,75,2,1,1,1,3]"
  ```

Scoring Targets

- Aim for CRITICAL (≥70): combine network calls (+25), obfuscation (+30), env access (+20), eval (+25), plus ML.

Notes

- These packages are for demos/tests only; do not publish or install system-wide.
- Keep payloads inert; avoid adding real C2 endpoints.
