#!/usr/bin/env python3
from setuptools import setup

setup(
    name='py_backdoor',
    version='1.0.0',
    description='DEMO ONLY: Backdoor simulation for supply chain security testing',
    author='attacker@malware.io',
    license='UNLICENSED',
    py_modules=['run_backdoor'],
    entry_points={
        'console_scripts': [
            'py-backdoor=run_backdoor:main',
        ],
    },
    install_requires=[],
)
