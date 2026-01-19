# Supply Chain Guardian - Sandbox Environment

Isolated Docker-based sandbox for safely testing suspicious packages with comprehensive monitoring.

## Features

- **Network Monitoring**: Captures all network connections and identifies suspicious IPs
- **File System Monitoring**: Tracks file operations and detects sensitive file access
- **Behavior Analysis**: Generates detailed threat reports with risk scoring
- **Complete Isolation**: Runs in containerized environment with no network access
- **Multi-language Support**: Tests both npm (JavaScript) and PyPI (Python) packages

## Quick Start

### 1. Build the Sandbox

```bash
cd sandbox
chmod +x *.sh
./build_sandbox.sh
```

This creates a Docker image with all monitoring tools installed.

### 2. Test a Suspicious Package

```bash
./run_sandbox.sh sus_packages/auth-helper npm 30
```

**Arguments**:

- `package_path`: Path to package directory (relative to project root)
- `package_type`: `npm` or `pypi` (default: npm)
- `timeout`: Max execution time in seconds (default: 30)

### 3. Test All Suspicious Packages

```bash
./test_all.sh
```

Runs all packages in `sus_packages/` through the sandbox.

## How It Works

```text
┌─────────────────────────────────────────────────────┐
│              SANDBOX EXECUTION FLOW                  │
└─────────────────────────────────────────────────────┘

1. Package Mounted → Docker Container (read-only)
2. Start Monitoring
   ├─ Network Monitor (captures connections)
   └─ File Monitor (watches file operations)
3. Execute Package
   ├─ Install dependencies
   └─ Run main entry point
4. Stop Monitoring & Collect Logs
5. Behavior Analysis
   ├─ Analyze network activity
   ├─ Analyze file operations
   └─ Calculate risk score
6. Generate Report
   └─ Save results + recommendations
```

## Monitoring Components

### Network Monitor (`network_monitor.py`)

- Captures all network connections using `netstat`
- Identifies suspicious external IPs
- Filters out known safe CDNs/registries
- Logs connection attempts with timestamps

### File Monitor (`file_monitor.py`)

- Uses `watchdog` to track file system events
- Monitors sensitive paths (`/home`, `.ssh`, `.env`)
- Detects suspicious file patterns (credentials, secrets)
- Flags deletions and modifications

### Behavior Analyzer (`behavior_analyzer.py`)

- Combines network + file + execution data
- Calculates risk score (0-100)
- Classifies threat level: CRITICAL / MEDIUM / LOW
- Generates actionable recommendations

## Risk Scoring

| Score | Threat Level | Action                         |
| ----- | ------------ | ------------------------------ |
| ≥70   | CRITICAL     | Auto-block, report to registry |
| 40-69 | MEDIUM       | Manual review required         |
| <40   | LOW          | Safe to install                |

**Risk Factors**:

- Network connections: +15 points
- Suspicious IPs: +35 points
- Sensitive file access: +30 points
- SSH key access: +25 points
- Environment variable access: +20 points
- File deletions: +10 points

## Output Files

After execution, check:

- `sandbox/results/<execution_id>_result.json` - Execution log
- `sandbox/results/<execution_id>_analysis.json` - Threat analysis
- `sandbox/logs/<execution_id>_network.json` - Network activity
- `sandbox/logs/<execution_id>_files.json` - File operations

## Example Analysis Report

```text
========================================
SANDBOX BEHAVIOR ANALYSIS REPORT
========================================

Execution ID: auth-helper_1737234567
Risk Score: 96/100
Threat Level: CRITICAL
Verdict: MALICIOUS

────────────────────────────────────────
FINDINGS
────────────────────────────────────────

1. 🚨 [CRITICAL] suspicious_ip
   Connected to 1 suspicious IPs
   - 45.142.212.61

2. 🚨 [CRITICAL] sensitive_file_access
   Accessed 2 sensitive files
   - /home/user/.ssh/id_rsa
   - /home/user/.env

────────────────────────────────────────
RECOMMENDATIONS
────────────────────────────────────────

1. 🚨 BLOCK this package immediately
2. 🔍 Report to package registry security team
3. 🛡️ Scan all existing installations
4. 🌐 Investigate all external IP connections
5. 🔐 Check for credential theft attempts
```

## Security Features

- **No Network Access**: Container runs with `--network none`
- **Minimal Capabilities**: All capabilities dropped except NET_ADMIN (for monitoring)
- **Read-only Package Mount**: Package code cannot be modified
- **Non-root User**: Runs as unprivileged `sandbox` user
- **Resource Limits**: Timeout prevents infinite loops
- **Isolated Filesystem**: No access to host system

## Integration with Main System

The sandbox can be integrated into the analysis pipeline:

```python
# In backend/analyzer.py
from sandbox.sandbox_controller import SandboxController

if risk_score >= 40:  # Medium or higher threat
    sandbox = SandboxController()
    sandbox_report = sandbox.test_package(package_path, package_type)

    if sandbox_report['risk_score'] >= 70:
        action = 'BLOCK'
    elif sandbox_report['risk_score'] >= 40:
        action = 'REVIEW'
    else:
        action = 'ALLOW'
```

## Troubleshooting

### Docker Permission Denied

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Package Fails to Install

Check execution logs: `sandbox/results/<execution_id>_result.json`

### No Network Connections Detected

Network monitor requires NET_ADMIN capability - do not remove.

### Analysis Report Not Generated

Ensure all monitoring scripts completed successfully:

- Check `sandbox/logs/` for monitor outputs
- Verify timeout is sufficient for package execution

## Development

To add new monitoring capabilities:

1. Create monitor script in `sandbox/`
2. Add to `Dockerfile` COPY commands
3. Start monitor in `sandbox_runner.py` → `setup_monitoring()`
4. Process results in `behavior_analyzer.py`

## Performance

- Image build: ~2-3 minutes
- Package test: ~30-60 seconds per package
- Analysis generation: ~1-2 seconds

## Testing

```bash
# Test sandbox build
./build_sandbox.sh

# Test single package
./run_sandbox.sh sus_packages/auth-helper npm 30

# Test all packages
./test_all.sh

# View results
cat sandbox/results/*_analysis.json | jq '.risk_score'
```

## Production Considerations

For production deployment:

1. **Use container orchestration** (Kubernetes, ECS)
2. **Implement rate limiting** to prevent DoS
3. **Add result caching** to avoid re-analyzing same packages
4. **Enable alerts** for CRITICAL threats (email, Slack, PagerDuty)
5. **Store results in database** instead of JSON files
6. **Add machine learning** to improve risk scoring over time

## License

Part of Supply Chain Guardian - Hackathon Project
