#!/usr/bin/env python3
"""
Supply Chain Guardian - Sandbox Runner
Executes packages in isolated environment with monitoring
"""

import os
import sys
import json
import subprocess
import time
import signal
from pathlib import Path
from datetime import datetime
import multiprocessing as mp


class SandboxRunner:
    """Manages package execution in sandbox with timeout and monitoring"""
    
    def __init__(self, package_path, package_type='npm', timeout=30):
        """
        Args:
            package_path: Path to package directory
            package_type: 'npm' or 'pypi'
            timeout: Max execution time in seconds
        """
        self.package_path = Path(package_path)
        self.package_type = package_type
        self.timeout = timeout
        self.results_dir = Path('/sandbox/results')
        self.logs_dir = Path('/sandbox/logs')
        
        # Create output directories
        self.results_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)
        
        self.execution_id = f"{self.package_path.name}_{int(time.time())}"
        
    def setup_monitoring(self):
        """Start network and file monitoring in background"""
        monitors = {}
        
        # Start network monitor
        net_monitor_proc = subprocess.Popen(
            ['python', '/sandbox/network_monitor.py', self.execution_id],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        monitors['network'] = net_monitor_proc
        
        # Start file monitor
        file_monitor_proc = subprocess.Popen(
            ['python', '/sandbox/file_monitor.py', self.execution_id, str(self.package_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        monitors['file'] = file_monitor_proc
        
        time.sleep(1)  # Let monitors initialize
        return monitors
    
    def stop_monitoring(self, monitors):
        """Stop all monitoring processes"""
        for name, proc in monitors.items():
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except:
                proc.kill()
    
    def run_npm_package(self):
        """Execute npm package"""
        print(f"[Sandbox] Running npm package: {self.package_path}")
        
        # Install dependencies (with network monitoring)
        install_cmd = ['npm', 'install', '--prefix', str(self.package_path)]
        install_result = subprocess.run(
            install_cmd,
            cwd=str(self.package_path),
            capture_output=True,
            timeout=self.timeout,
            text=True
        )
        
        # Try to run main entry point
        package_json = self.package_path / 'package.json'
        if package_json.exists():
            with open(package_json) as f:
                pkg_data = json.load(f)
                main_file = pkg_data.get('main', 'index.js')
        else:
            main_file = 'index.js'
        
        # Execute main file
        run_cmd = ['node', str(self.package_path / main_file)]
        run_result = subprocess.run(
            run_cmd,
            capture_output=True,
            timeout=self.timeout,
            text=True
        )
        
        return {
            'install': {
                'stdout': install_result.stdout,
                'stderr': install_result.stderr,
                'returncode': install_result.returncode
            },
            'run': {
                'stdout': run_result.stdout,
                'stderr': run_result.stderr,
                'returncode': run_result.returncode
            }
        }
    
    def run_python_package(self):
        """Execute Python package"""
        print(f"[Sandbox] Running Python package: {self.package_path}")
        
        # Install package in editable mode
        install_cmd = ['pip', 'install', '-e', str(self.package_path)]
        install_result = subprocess.run(
            install_cmd,
            capture_output=True,
            timeout=self.timeout,
            text=True
        )
        
        # Try to import and run
        init_file = self.package_path / '__init__.py'
        if init_file.exists():
            # Run as module
            pkg_name = self.package_path.name
            run_cmd = ['python', '-c', f'import {pkg_name}']
        else:
            # Look for main file
            main_files = list(self.package_path.glob('*.py'))
            if main_files:
                run_cmd = ['python', str(main_files[0])]
            else:
                return {'error': 'No Python files found'}
        
        run_result = subprocess.run(
            run_cmd,
            capture_output=True,
            timeout=self.timeout,
            text=True
        )
        
        return {
            'install': {
                'stdout': install_result.stdout,
                'stderr': install_result.stderr,
                'returncode': install_result.returncode
            },
            'run': {
                'stdout': run_result.stdout,
                'stderr': run_result.stderr,
                'returncode': run_result.returncode
            }
        }
    
    def execute(self):
        """Main execution flow with monitoring"""
        print(f"[Sandbox] Starting execution: {self.execution_id}")
        start_time = time.time()
        
        # Start monitors
        monitors = self.setup_monitoring()
        
        try:
            # Run package based on type
            if self.package_type == 'npm':
                execution_result = self.run_npm_package()
            elif self.package_type == 'pypi':
                execution_result = self.run_python_package()
            else:
                execution_result = {'error': f'Unknown package type: {self.package_type}'}
            
        except subprocess.TimeoutExpired:
            execution_result = {
                'error': f'Execution timeout after {self.timeout}s',
                'timeout': True
            }
        except Exception as e:
            execution_result = {
                'error': str(e),
                'exception': type(e).__name__
            }
        finally:
            # Stop monitors
            self.stop_monitoring(monitors)
        
        end_time = time.time()
        
        # Compile results
        result = {
            'execution_id': self.execution_id,
            'package_path': str(self.package_path),
            'package_type': self.package_type,
            'start_time': datetime.fromtimestamp(start_time).isoformat(),
            'end_time': datetime.fromtimestamp(end_time).isoformat(),
            'duration': end_time - start_time,
            'execution': execution_result
        }
        
        # Save results
        result_file = self.results_dir / f'{self.execution_id}_result.json'
        with open(result_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"[Sandbox] Execution complete: {result_file}")
        return result


def main():
    """CLI entry point"""
    if len(sys.argv) < 2:
        print("Usage: sandbox_runner.py <package_path> [package_type] [timeout]")
        print("  package_path: Path to package directory")
        print("  package_type: npm or pypi (default: npm)")
        print("  timeout: Max execution time in seconds (default: 30)")
        sys.exit(1)
    
    package_path = sys.argv[1]
    package_type = sys.argv[2] if len(sys.argv) > 2 else 'npm'
    timeout = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    
    runner = SandboxRunner(package_path, package_type, timeout)
    result = runner.execute()
    
    # Print summary
    print("\n" + "="*60)
    print("SANDBOX EXECUTION SUMMARY")
    print("="*60)
    print(json.dumps(result, indent=2))
    print("="*60)


if __name__ == '__main__':
    main()
