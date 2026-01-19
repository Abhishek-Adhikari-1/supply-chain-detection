#!/usr/bin/env python3
"""
Supply Chain Guardian - File System Monitor
Tracks all file operations during package execution
"""

import os
import sys
import json
import time
import threading
from datetime import datetime
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


class FileActivityHandler(FileSystemEventHandler):
    """Handler for file system events"""
    
    def __init__(self, monitor):
        self.monitor = monitor
        super().__init__()
    
    def on_created(self, event):
        if not event.is_directory:
            self.monitor.log_event('created', event.src_path)
    
    def on_modified(self, event):
        if not event.is_directory:
            self.monitor.log_event('modified', event.src_path)
    
    def on_deleted(self, event):
        if not event.is_directory:
            self.monitor.log_event('deleted', event.src_path)
    
    def on_moved(self, event):
        if not event.is_directory:
            self.monitor.log_event('moved', event.src_path, dest=event.dest_path)


class FileMonitor:
    """Monitors file system operations during sandbox execution"""
    
    def __init__(self, execution_id, watch_path='/sandbox'):
        self.execution_id = execution_id
        self.watch_path = Path(watch_path)
        self.logs_dir = Path('/sandbox/logs')
        self.logs_dir.mkdir(exist_ok=True)
        
        self.events = []
        self.start_time = None
        self.observer = None
        
        # Sensitive paths to monitor
        self.sensitive_paths = [
            '/home',
            '/root',
            '/etc',
            '/.ssh',
            '/.aws',
            '/.env',
        ]
        
        # Suspicious file patterns
        self.suspicious_patterns = [
            '.ssh',
            '.env',
            'id_rsa',
            'credentials',
            'password',
            'secret',
            'token',
            'api_key',
        ]
    
    def log_event(self, event_type, path, dest=None):
        """Log a file system event"""
        event = {
            'type': event_type,
            'path': str(path),
            'timestamp': datetime.now().isoformat(),
            'suspicious': self.is_suspicious_path(path)
        }
        
        if dest:
            event['destination'] = str(dest)
        
        self.events.append(event)
        
        # Log suspicious activities immediately
        if event['suspicious']:
            print(f"[FileMonitor] ⚠️  SUSPICIOUS {event_type}: {path}")
        else:
            print(f"[FileMonitor] {event_type}: {path}")
    
    def is_suspicious_path(self, path):
        """Check if file path is suspicious"""
        path_str = str(path).lower()
        
        # Check sensitive directories
        for sensitive in self.sensitive_paths:
            if sensitive in path_str:
                return True
        
        # Check suspicious patterns
        for pattern in self.suspicious_patterns:
            if pattern in path_str:
                return True
        
        return False
    
    def analyze_file_operations(self):
        """Analyze collected file operations for threats"""
        analysis = {
            'total_events': len(self.events),
            'suspicious_events': [],
            'created_files': [],
            'modified_files': [],
            'deleted_files': [],
            'accessed_sensitive': []
        }
        
        for event in self.events:
            event_type = event['type']
            
            if event_type == 'created':
                analysis['created_files'].append(event['path'])
            elif event_type == 'modified':
                analysis['modified_files'].append(event['path'])
            elif event_type == 'deleted':
                analysis['deleted_files'].append(event['path'])
            
            if event['suspicious']:
                analysis['suspicious_events'].append(event)
                analysis['accessed_sensitive'].append(event['path'])
        
        # Threat indicators
        analysis['threat_indicators'] = {
            'writes_to_home': any('/home' in e['path'] for e in self.events),
            'accesses_ssh': any('.ssh' in e['path'] for e in self.events),
            'accesses_env': any('.env' in e['path'] for e in self.events),
            'deletes_files': len(analysis['deleted_files']) > 0,
            'modifies_system': any('/etc' in e['path'] for e in self.events),
        }
        
        return analysis
    
    def start(self):
        """Start monitoring file system"""
        print(f"[FileMonitor] Starting for execution: {self.execution_id}")
        print(f"[FileMonitor] Watching: {self.watch_path}")
        
        self.start_time = time.time()
        
        # Set up watchdog observer
        self.observer = Observer()
        handler = FileActivityHandler(self)
        
        # Watch the package directory
        self.observer.schedule(handler, str(self.watch_path), recursive=True)
        
        # Also watch sensitive directories if they exist
        for sensitive_path in self.sensitive_paths:
            if Path(sensitive_path).exists():
                try:
                    self.observer.schedule(handler, sensitive_path, recursive=True)
                    print(f"[FileMonitor] Watching sensitive: {sensitive_path}")
                except:
                    pass
        
        self.observer.start()
    
    def stop(self):
        """Stop monitoring and save results"""
        print(f"[FileMonitor] Stopping...")
        
        if self.observer:
            self.observer.stop()
            self.observer.join(timeout=5)
        
        duration = time.time() - self.start_time if self.start_time else 0
        
        # Analyze operations
        analysis = self.analyze_file_operations()
        
        # Compile results
        result = {
            'execution_id': self.execution_id,
            'watch_path': str(self.watch_path),
            'duration': duration,
            'events': self.events,
            'analysis': analysis
        }
        
        # Save to file
        log_file = self.logs_dir / f'{self.execution_id}_files.json'
        with open(log_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"[FileMonitor] Results saved: {log_file}")
        print(f"[FileMonitor] Total events: {len(self.events)}")
        print(f"[FileMonitor] Suspicious: {len(analysis['suspicious_events'])}")
        
        return result


def main():
    """Run file monitor as standalone process"""
    if len(sys.argv) < 3:
        print("Usage: file_monitor.py <execution_id> <watch_path> [duration]")
        sys.exit(1)
    
    execution_id = sys.argv[1]
    watch_path = sys.argv[2]
    duration = int(sys.argv[3]) if len(sys.argv) > 3 else 60
    
    monitor = FileMonitor(execution_id, watch_path)
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
