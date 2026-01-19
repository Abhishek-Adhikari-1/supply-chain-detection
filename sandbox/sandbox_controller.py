#!/usr/bin/env python3
"""
Supply Chain Guardian - Sandbox Controller
Python interface for running sandbox tests from backend
"""

import os
import json
import subprocess
import time
from pathlib import Path
from typing import Dict, Optional


class SandboxController:
    """Controls sandbox execution from Python code"""
    
    def __init__(self, sandbox_dir: Optional[str] = None):
        """
        Args:
            sandbox_dir: Path to sandbox directory (default: auto-detect)
        """
        if sandbox_dir:
            self.sandbox_dir = Path(sandbox_dir)
        else:
            # Auto-detect sandbox directory
            current_dir = Path(__file__).parent
            self.sandbox_dir = current_dir if current_dir.name == 'sandbox' else current_dir / 'sandbox'
        
        self.results_dir = self.sandbox_dir / 'results'
        self.logs_dir = self.sandbox_dir / 'logs'
        
        # Ensure directories exist
        self.results_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
    
    def is_sandbox_built(self) -> bool:
        """Check if sandbox Docker image exists"""
        try:
            result = subprocess.run(
                ['docker', 'images', '-q', 'supply-chain-guardian-sandbox'],
                capture_output=True,
                text=True
            )
            return bool(result.stdout.strip())
        except:
            return False
    
    def build_sandbox(self) -> bool:
        """Build sandbox Docker image"""
        print("[SandboxController] Building sandbox image...")
        
        build_script = self.sandbox_dir / 'build_sandbox.sh'
        
        try:
            result = subprocess.run(
                ['bash', str(build_script)],
                cwd=str(self.sandbox_dir),
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout for build
            )
            
            if result.returncode == 0:
                print("[SandboxController] Sandbox built successfully")
                return True
            else:
                print(f"[SandboxController] Build failed: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            print("[SandboxController] Build timeout")
            return False
        except Exception as e:
            print(f"[SandboxController] Build error: {e}")
            return False
    
    def test_package(
        self, 
        package_path: str, 
        package_type: str = 'npm',
        timeout: int = 30,
        auto_build: bool = True
    ) -> Dict:
        """
        Test a package in the sandbox
        
        Args:
            package_path: Path to package directory (relative to project root)
            package_type: 'npm' or 'pypi'
            timeout: Execution timeout in seconds
            auto_build: Automatically build sandbox if not exists
            
        Returns:
            Dict with analysis results and risk assessment
        """
        # Check if sandbox is built
        if not self.is_sandbox_built():
            if auto_build:
                if not self.build_sandbox():
                    return {
                        'error': 'Sandbox image not available and build failed',
                        'risk_score': 0
                    }
            else:
                return {
                    'error': 'Sandbox image not built. Run build_sandbox.sh first.',
                    'risk_score': 0
                }
        
        print(f"[SandboxController] Testing package: {package_path}")
        
        run_script = self.sandbox_dir / 'run_sandbox.sh'
        
        try:
            # Run sandbox test
            result = subprocess.run(
                ['bash', str(run_script), package_path, package_type, str(timeout)],
                cwd=str(self.sandbox_dir),
                capture_output=True,
                text=True,
                timeout=timeout + 60  # Add buffer for sandbox overhead
            )
            
            # Find the latest analysis result
            analysis_files = sorted(
                self.results_dir.glob('*_analysis.json'),
                key=lambda f: f.stat().st_mtime,
                reverse=True
            )
            
            if not analysis_files:
                return {
                    'error': 'No analysis results generated',
                    'risk_score': 0,
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
            
            # Load the latest analysis
            with open(analysis_files[0]) as f:
                analysis = json.load(f)
            
            print(f"[SandboxController] Analysis complete: Risk Score {analysis['risk_score']}/100")
            
            return analysis
            
        except subprocess.TimeoutExpired:
            return {
                'error': f'Sandbox execution timeout after {timeout + 60}s',
                'risk_score': 50,  # Medium risk for timeout
                'timeout': True
            }
        except json.JSONDecodeError as e:
            return {
                'error': f'Failed to parse analysis results: {e}',
                'risk_score': 0
            }
        except Exception as e:
            return {
                'error': f'Sandbox execution error: {e}',
                'risk_score': 0
            }
    
    def get_analysis_by_id(self, execution_id: str) -> Optional[Dict]:
        """Get analysis results by execution ID"""
        analysis_file = self.results_dir / f'{execution_id}_analysis.json'
        
        if not analysis_file.exists():
            return None
        
        with open(analysis_file) as f:
            return json.load(f)
    
    def get_recent_analyses(self, limit: int = 10) -> list:
        """Get recent analysis results"""
        analysis_files = sorted(
            self.results_dir.glob('*_analysis.json'),
            key=lambda f: f.stat().st_mtime,
            reverse=True
        )
        
        results = []
        for file in analysis_files[:limit]:
            try:
                with open(file) as f:
                    results.append(json.load(f))
            except:
                continue
        
        return results
    
    def cleanup_old_results(self, days: int = 7):
        """Remove analysis results older than specified days"""
        cutoff = time.time() - (days * 86400)
        removed = 0
        
        for file in self.results_dir.glob('*.json'):
            if file.stat().st_mtime < cutoff:
                file.unlink()
                removed += 1
        
        for file in self.logs_dir.glob('*.json'):
            if file.stat().st_mtime < cutoff:
                file.unlink()
                removed += 1
        
        print(f"[SandboxController] Cleaned up {removed} old files")
        return removed


def main():
    """Demo usage"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python sandbox_controller.py <package_path> [package_type]")
        print("\nExample:")
        print("  python sandbox_controller.py sus_packages/auth-helper npm")
        sys.exit(1)
    
    package_path = sys.argv[1]
    package_type = sys.argv[2] if len(sys.argv) > 2 else 'npm'
    
    controller = SandboxController()
    result = controller.test_package(package_path, package_type)
    
    print("\n" + "="*60)
    print("SANDBOX TEST RESULT")
    print("="*60)
    print(json.dumps(result, indent=2))
    print("="*60)


if __name__ == '__main__':
    main()
