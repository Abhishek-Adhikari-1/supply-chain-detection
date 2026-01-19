#!/usr/bin/env python3
"""
Supply Chain Guardian - Network Monitor
Captures all network activity during package execution
"""

import os
import sys
import json
import socket
import time
import threading
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import subprocess
import re


class NetworkMonitor:
    """Monitors network connections during sandbox execution"""
    
    def __init__(self, execution_id):
        self.execution_id = execution_id
        self.logs_dir = Path('/sandbox/logs')
        self.logs_dir.mkdir(exist_ok=True)
        
        self.connections = []
        self.dns_queries = []
        self.http_requests = []
        
        self.monitoring = False
        self.start_time = None
        
    def parse_netstat_output(self, output):
        """Parse netstat output for active connections"""
        connections = []
        lines = output.strip().split('\n')[2:]  # Skip headers
        
        for line in lines:
            parts = line.split()
            if len(parts) >= 5:
                try:
                    proto = parts[0]
                    local_addr = parts[3]
                    remote_addr = parts[4]
                    state = parts[5] if len(parts) > 5 else 'UNKNOWN'
                    
                    # Parse IP and port
                    if ':' in remote_addr:
                        remote_ip, remote_port = remote_addr.rsplit(':', 1)
                        
                        # Filter out localhost and known safe IPs
                        if not remote_ip.startswith('127.') and remote_ip != '0.0.0.0':
                            connections.append({
                                'protocol': proto,
                                'local': local_addr,
                                'remote': remote_addr,
                                'remote_ip': remote_ip,
                                'remote_port': remote_port,
                                'state': state,
                                'timestamp': datetime.now().isoformat()
                            })
                except:
                    continue
        
        return connections
    
    def capture_connections(self):
        """Continuously capture network connections"""
        print(f"[NetworkMonitor] Starting for execution: {self.execution_id}")
        self.start_time = time.time()
        
        seen_connections = set()
        
        while self.monitoring:
            try:
                # Use netstat to capture connections
                result = subprocess.run(
                    ['netstat', '-antp'],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                
                new_connections = self.parse_netstat_output(result.stdout)
                
                for conn in new_connections:
                    conn_key = f"{conn['remote_ip']}:{conn['remote_port']}"
                    
                    # Only log new connections
                    if conn_key not in seen_connections:
                        seen_connections.add(conn_key)
                        self.connections.append(conn)
                        
                        print(f"[NetworkMonitor] New connection: {conn_key}")
                        
                        # Check for suspicious IPs (hardcoded/external)
                        if self.is_suspicious_ip(conn['remote_ip']):
                            print(f"[NetworkMonitor] ⚠️  SUSPICIOUS IP: {conn['remote_ip']}")
                
            except Exception as e:
                print(f"[NetworkMonitor] Error: {e}")
            
            time.sleep(0.5)  # Poll every 500ms
    
    def is_suspicious_ip(self, ip):
        """Check if IP is suspicious (not common CDN/registry)"""
        # Known safe patterns (npm registry, GitHub, etc.)
        safe_prefixes = [
            '104.16.',  # Cloudflare CDN
            '151.101.',  # Fastly CDN
            '185.199.',  # GitHub
            '140.82.',   # GitHub
        ]
        
        for prefix in safe_prefixes:
            if ip.startswith(prefix):
                return False
        
        # Check if it's a private IP
        if ip.startswith('10.') or ip.startswith('192.168.') or ip.startswith('172.'):
            return False
        
        # Everything else is potentially suspicious
        return True
    
    def start(self):
        """Start monitoring in background thread"""
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self.capture_connections)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
    
    def stop(self):
        """Stop monitoring and save results"""
        print(f"[NetworkMonitor] Stopping...")
        self.monitoring = False
        
        if hasattr(self, 'monitor_thread'):
            self.monitor_thread.join(timeout=5)
        
        # Save results
        duration = time.time() - self.start_time if self.start_time else 0
        
        result = {
            'execution_id': self.execution_id,
            'duration': duration,
            'total_connections': len(self.connections),
            'connections': self.connections,
            'dns_queries': self.dns_queries,
            'http_requests': self.http_requests,
            'suspicious_ips': [
                conn['remote_ip'] for conn in self.connections
                if self.is_suspicious_ip(conn['remote_ip'])
            ]
        }
        
        # Save to file
        log_file = self.logs_dir / f'{self.execution_id}_network.json'
        with open(log_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"[NetworkMonitor] Results saved: {log_file}")
        print(f"[NetworkMonitor] Total connections: {len(self.connections)}")
        print(f"[NetworkMonitor] Suspicious IPs: {len(result['suspicious_ips'])}")
        
        return result


def main():
    """Run network monitor as standalone process"""
    if len(sys.argv) < 2:
        print("Usage: network_monitor.py <execution_id> [duration]")
        sys.exit(1)
    
    execution_id = sys.argv[1]
    duration = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    
    monitor = NetworkMonitor(execution_id)
    monitor.start()
    
    # Monitor for specified duration
    try:
        time.sleep(duration)
    except KeyboardInterrupt:
        pass
    finally:
        monitor.stop()


if __name__ == '__main__':
    main()
