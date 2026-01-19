# MALICIOUS (DEMO): Backdoor code present for scanners but gated at runtime
import os

from .run_backdoor import run_backdoor_main  # noqa: F401

if os.getenv("RUN_DEMO") == "1":
	run_backdoor_main()
