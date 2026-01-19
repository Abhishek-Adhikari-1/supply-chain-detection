#!/usr/bin/env python3
"""
Supply Chain Guardian - Behavior Analyzer
Analyzes sandbox execution results and generates threat report
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List


class BehaviorAnalyzer:
    """Analyzes sandbox execution behavior and generates threat assessment"""
    
    def __init__(self, execution_id):
        self.execution_id = execution_id
        self.results_dir = Path('/sandbox/results')
        self.logs_dir = Path('/sandbox/logs')
        
        # Load data
        self.execution_data = self.load_json(
            self.results_dir / f'{execution_id}_result.json'
        )
        self.network_data = self.load_json(
            self.logs_dir / f'{execution_id}_network.json'
        )
        self.file_data = self.load_json(
            self.logs_dir / f'{execution_id}_files.json'
        )
    
    def load_json(self, file_path):
        """Load JSON file, return {} if not found"""
        try:
            with open(file_path) as f:
                return json.load(f)
        except:
            return {}
    
    def analyze_network_behavior(self) -> Dict:
        """Analyze network activity for threats"""
        if not self.network_data:
            return {'risk_score': 0, 'findings': []}
        
        findings = []
        risk_score = 0
        
        connections = self.network_data.get('connections', [])
        suspicious_ips = self.network_data.get('suspicious_ips', [])
        
        # Check for external connections
        if connections:
            findings.append({
                'severity': 'medium',
                'type': 'network_activity',
                'message': f'Made {len(connections)} network connections',
                'details': connections[:5]  # First 5
            })
            risk_score += 15
        
        # Check for suspicious IPs
        if suspicious_ips:
            findings.append({
                'severity': 'critical',
                'type': 'suspicious_ip',
                'message': f'Connected to {len(suspicious_ips)} suspicious IPs',
                'details': suspicious_ips
            })
            risk_score += 35
        
        return {
            'risk_score': min(risk_score, 50),
            'findings': findings,
            'connection_count': len(connections),
            'suspicious_ip_count': len(suspicious_ips)
        }
    
    def analyze_file_behavior(self) -> Dict:
        """Analyze file system activity for threats"""
        if not self.file_data:
            return {'risk_score': 0, 'findings': []}
        
        findings = []
        risk_score = 0
        
        analysis = self.file_data.get('analysis', {})
        threat_indicators = analysis.get('threat_indicators', {})
        suspicious_events = analysis.get('suspicious_events', [])
        
        # Check sensitive file access
        if suspicious_events:
            findings.append({
                'severity': 'critical',
                'type': 'sensitive_file_access',
                'message': f'Accessed {len(suspicious_events)} sensitive files',
                'details': [e['path'] for e in suspicious_events[:5]]
            })
            risk_score += 30
        
        # Check for SSH access
        if threat_indicators.get('accesses_ssh'):
            findings.append({
                'severity': 'critical',
                'type': 'ssh_access',
                'message': 'Attempted to access SSH keys',
                'details': 'Potential credential theft'
            })
            risk_score += 25
        
        # Check for env file access
        if threat_indicators.get('accesses_env'):
            findings.append({
                'severity': 'high',
                'type': 'env_access',
                'message': 'Accessed environment variables',
                'details': 'May be stealing API keys/secrets'
            })
            risk_score += 20
        
        # Check for file deletions
        deleted_count = len(analysis.get('deleted_files', []))
        if deleted_count > 0:
            findings.append({
                'severity': 'medium',
                'type': 'file_deletion',
                'message': f'Deleted {deleted_count} files',
                'details': 'Potential data destruction'
            })
            risk_score += 10
        
        return {
            'risk_score': min(risk_score, 50),
            'findings': findings,
            'threat_indicators': threat_indicators
        }
    
    def analyze_execution_behavior(self) -> Dict:
        """Analyze execution results for anomalies"""
        if not self.execution_data:
            return {'risk_score': 0, 'findings': []}
        
        findings = []
        risk_score = 0
        
        execution = self.execution_data.get('execution', {})
        
        # Check for errors that might indicate malicious code
        if 'error' in execution:
            findings.append({
                'severity': 'low',
                'type': 'execution_error',
                'message': 'Package execution failed',
                'details': execution['error']
            })
            risk_score += 5
        
        # Check for timeout (could indicate infinite loop/DoS)
        if execution.get('timeout'):
            findings.append({
                'severity': 'medium',
                'type': 'execution_timeout',
                'message': 'Package execution timed out',
                'details': 'Possible DoS or resource exhaustion'
            })
            risk_score += 15
        
        # Check stderr for suspicious output
        run_result = execution.get('run', {})
        stderr = run_result.get('stderr', '')
        if stderr and len(stderr) > 100:
            findings.append({
                'severity': 'low',
                'type': 'error_output',
                'message': 'Package produced error output',
                'details': stderr[:200]
            })
            risk_score += 5
        
        return {
            'risk_score': min(risk_score, 20),
            'findings': findings
        }
    
    def calculate_overall_risk(self, network_analysis, file_analysis, execution_analysis) -> int:
        """Calculate overall risk score"""
        total_score = (
            network_analysis['risk_score'] +
            file_analysis['risk_score'] +
            execution_analysis['risk_score']
        )
        
        # Cap at 100
        return min(total_score, 100)
    
    def classify_threat_level(self, risk_score: int) -> str:
        """Classify threat based on risk score"""
        if risk_score >= 70:
            return 'CRITICAL'
        elif risk_score >= 40:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def generate_recommendations(self, risk_score: int, all_findings: List) -> List[str]:
        """Generate security recommendations"""
        recommendations = []
        
        if risk_score >= 70:
            recommendations.append('🚨 BLOCK this package immediately')
            recommendations.append('🔍 Report to package registry security team')
            recommendations.append('🛡️ Scan all existing installations')
        elif risk_score >= 40:
            recommendations.append('⚠️ Do not install without thorough review')
            recommendations.append('👁️ Manually inspect suspicious behaviors')
            recommendations.append('🔬 Consider alternative packages')
        else:
            recommendations.append('✅ Package appears safe based on sandbox test')
            recommendations.append('📊 Monitor for updates')
        
        # Specific recommendations based on findings
        finding_types = {f['type'] for f in all_findings}
        
        if 'suspicious_ip' in finding_types:
            recommendations.append('🌐 Investigate all external IP connections')
        
        if 'ssh_access' in finding_types or 'sensitive_file_access' in finding_types:
            recommendations.append('🔐 Check for credential theft attempts')
        
        if 'env_access' in finding_types:
            recommendations.append('🔑 Verify API keys have not been compromised')
        
        return recommendations
    
    def generate_report(self) -> Dict:
        """Generate comprehensive threat analysis report"""
        print(f"[Analyzer] Generating report for: {self.execution_id}")
        
        # Analyze each component
        network_analysis = self.analyze_network_behavior()
        file_analysis = self.analyze_file_behavior()
        execution_analysis = self.analyze_execution_behavior()
        
        # Calculate overall risk
        risk_score = self.calculate_overall_risk(
            network_analysis, 
            file_analysis, 
            execution_analysis
        )
        threat_level = self.classify_threat_level(risk_score)
        
        # Compile all findings
        all_findings = (
            network_analysis['findings'] +
            file_analysis['findings'] +
            execution_analysis['findings']
        )
        
        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        all_findings.sort(key=lambda f: severity_order.get(f['severity'], 4))
        
        # Generate recommendations
        recommendations = self.generate_recommendations(risk_score, all_findings)
        
        # Compile report
        report = {
            'execution_id': self.execution_id,
            'timestamp': datetime.now().isoformat(),
            'risk_score': risk_score,
            'threat_level': threat_level,
            'verdict': 'MALICIOUS' if risk_score >= 70 else 'SUSPICIOUS' if risk_score >= 40 else 'SAFE',
            'summary': {
                'total_findings': len(all_findings),
                'critical_findings': len([f for f in all_findings if f['severity'] == 'critical']),
                'network_connections': network_analysis.get('connection_count', 0),
                'suspicious_ips': network_analysis.get('suspicious_ip_count', 0),
                'file_operations': len(self.file_data.get('events', [])),
            },
            'analysis': {
                'network': network_analysis,
                'file_system': file_analysis,
                'execution': execution_analysis
            },
            'findings': all_findings,
            'recommendations': recommendations
        }
        
        # Save report
        report_file = self.results_dir / f'{self.execution_id}_analysis.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"[Analyzer] Report saved: {report_file}")
        print(f"[Analyzer] Risk Score: {risk_score}/100 ({threat_level})")
        
        return report
    
    def print_report(self, report: Dict):
        """Print formatted report to console"""
        print("\n" + "="*70)
        print("SANDBOX BEHAVIOR ANALYSIS REPORT")
        print("="*70)
        print(f"\nExecution ID: {report['execution_id']}")
        print(f"Timestamp: {report['timestamp']}")
        print(f"\nRISK SCORE: {report['risk_score']}/100")
        print(f"THREAT LEVEL: {report['threat_level']}")
        print(f"VERDICT: {report['verdict']}")
        
        print(f"\n{'─'*70}")
        print("SUMMARY")
        print(f"{'─'*70}")
        summary = report['summary']
        print(f"Total Findings: {summary['total_findings']}")
        print(f"Critical Findings: {summary['critical_findings']}")
        print(f"Network Connections: {summary['network_connections']}")
        print(f"Suspicious IPs: {summary['suspicious_ips']}")
        print(f"File Operations: {summary['file_operations']}")
        
        if report['findings']:
            print(f"\n{'─'*70}")
            print("FINDINGS")
            print(f"{'─'*70}")
            for i, finding in enumerate(report['findings'], 1):
                severity_emoji = {
                    'critical': '🚨',
                    'high': '⚠️',
                    'medium': '⚡',
                    'low': 'ℹ️'
                }
                emoji = severity_emoji.get(finding['severity'], '•')
                print(f"\n{i}. {emoji} [{finding['severity'].upper()}] {finding['type']}")
                print(f"   {finding['message']}")
                if 'details' in finding:
                    details = finding['details']
                    if isinstance(details, list):
                        for detail in details[:3]:
                            print(f"   - {detail}")
                    else:
                        print(f"   Details: {details}")
        
        print(f"\n{'─'*70}")
        print("RECOMMENDATIONS")
        print(f"{'─'*70}")
        for i, rec in enumerate(report['recommendations'], 1):
            print(f"{i}. {rec}")
        
        print("\n" + "="*70)


def main():
    """CLI entry point"""
    if len(sys.argv) < 2:
        print("Usage: behavior_analyzer.py <execution_id>")
        sys.exit(1)
    
    execution_id = sys.argv[1]
    
    analyzer = BehaviorAnalyzer(execution_id)
    report = analyzer.generate_report()
    analyzer.print_report(report)


if __name__ == '__main__':
    main()
