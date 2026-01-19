"""
Supply Chain Guardian - Sandbox Integration Example
Shows how to integrate sandbox testing into the analysis pipeline
"""

import sys
from pathlib import Path

# Add sandbox to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'sandbox'))

from sandbox_controller import SandboxController


class ThreatAnalyzer:
    """Enhanced threat analyzer with sandbox testing capability"""
    
    def __init__(self):
        self.sandbox = SandboxController()
    
    def analyze_package_update(
        self, 
        package_name: str,
        old_version: str,
        new_version: str,
        package_path: str,
        package_type: str = 'npm'
    ):
        """
        Complete analysis pipeline with optional sandbox testing
        
        Args:
            package_name: Name of the package
            old_version: Previous version
            new_version: New version to analyze
            package_path: Path to new version code
            package_type: 'npm' or 'pypi'
        
        Returns:
            Complete threat assessment with sandbox results
        """
        print(f"\n{'='*60}")
        print(f"Analyzing: {package_name} {old_version} → {new_version}")
        print(f"{'='*60}\n")
        
        # Step 1: Static Analysis (Feature Extraction + ML Model)
        print("[1/3] Running static analysis...")
        static_risk = self.static_analysis(package_path)
        print(f"      Static Risk Score: {static_risk}/100")
        
        # Step 2: Decide if sandbox testing is needed
        needs_sandbox = static_risk >= 40  # MEDIUM or CRITICAL
        
        sandbox_result = None
        if needs_sandbox:
            print(f"\n[2/3] Risk score {static_risk} → Running sandbox test...")
            sandbox_result = self.sandbox.test_package(
                package_path, 
                package_type,
                timeout=30
            )
            
            if 'error' not in sandbox_result:
                print(f"      Sandbox Risk Score: {sandbox_result['risk_score']}/100")
                print(f"      Verdict: {sandbox_result['verdict']}")
            else:
                print(f"      Sandbox Error: {sandbox_result['error']}")
        else:
            print(f"\n[2/3] Risk score {static_risk} → Skipping sandbox (low risk)")
        
        # Step 3: Combine results and make final decision
        print(f"\n[3/3] Making final decision...")
        final_assessment = self.make_decision(static_risk, sandbox_result)
        
        print(f"\n{'='*60}")
        print("FINAL ASSESSMENT")
        print(f"{'='*60}")
        print(f"Combined Risk Score: {final_assessment['risk_score']}/100")
        print(f"Threat Level: {final_assessment['threat_level']}")
        print(f"Action: {final_assessment['action']}")
        print(f"Confidence: {final_assessment['confidence']}%")
        
        if final_assessment['findings']:
            print(f"\nKey Findings:")
            for finding in final_assessment['findings'][:5]:
                print(f"  • {finding}")
        
        print(f"\nRecommendation: {final_assessment['recommendation']}")
        print(f"{'='*60}\n")
        
        return final_assessment
    
    def static_analysis(self, package_path: str) -> int:
        """
        Placeholder for static analysis (feature extraction + ML model)
        In real implementation, this would:
        1. Extract 9 features (network calls, obfuscation, etc.)
        2. Run ML model prediction
        3. Apply rule-based scoring
        4. Return hybrid risk score
        """
        # TODO: Implement actual feature extraction and ML prediction
        # For demo, return a mock score
        return 75  # Example: CRITICAL risk
    
    def make_decision(self, static_risk: int, sandbox_result: dict) -> dict:
        """
        Combine static analysis and sandbox results for final decision
        
        Decision Logic:
        - If sandbox confirms high risk → BLOCK
        - If sandbox contradicts static → Trust sandbox (it's actual behavior)
        - If no sandbox → Use static analysis only
        """
        if sandbox_result and 'error' not in sandbox_result:
            # Sandbox tested - use sandbox result as primary
            sandbox_risk = sandbox_result['risk_score']
            
            # Weighted combination: 70% sandbox, 30% static
            # (Sandbox = actual behavior, more reliable)
            combined_risk = int(sandbox_risk * 0.7 + static_risk * 0.3)
            
            findings = []
            if sandbox_result.get('findings'):
                findings = [f['message'] for f in sandbox_result['findings']]
            
            confidence = 90  # High confidence with sandbox validation
            
        else:
            # No sandbox - use static analysis only
            combined_risk = static_risk
            findings = [
                "Static analysis indicates potential threat",
                "Sandbox testing recommended for confirmation"
            ]
            confidence = 60  # Lower confidence without behavioral validation
        
        # Determine action based on combined risk
        if combined_risk >= 70:
            action = 'BLOCK'
            threat_level = 'CRITICAL'
            recommendation = '🚨 Block this package immediately and report to registry'
        elif combined_risk >= 40:
            action = 'REVIEW'
            threat_level = 'MEDIUM'
            recommendation = '⚠️ Manual review required before installation'
        else:
            action = 'ALLOW'
            threat_level = 'LOW'
            recommendation = '✅ Safe to install with monitoring'
        
        return {
            'risk_score': combined_risk,
            'threat_level': threat_level,
            'action': action,
            'confidence': confidence,
            'findings': findings,
            'recommendation': recommendation,
            'static_risk': static_risk,
            'sandbox_risk': sandbox_result.get('risk_score') if sandbox_result else None,
            'sandbox_tested': sandbox_result is not None and 'error' not in sandbox_result
        }


# Example Usage
if __name__ == '__main__':
    analyzer = ThreatAnalyzer()
    
    # Test Case 1: Malicious npm package
    print("\n" + "🔴 TEST CASE 1: Suspicious Package".center(60, "="))
    result1 = analyzer.analyze_package_update(
        package_name='auth-helper',
        old_version='2.1.0',
        new_version='2.1.1',
        package_path='sus_packages/auth-helper',
        package_type='npm'
    )
    
    # Test Case 2: Another malicious package
    print("\n" + "🔴 TEST CASE 2: Crypto Miner".center(60, "="))
    result2 = analyzer.analyze_package_update(
        package_name='crypto-miner',
        old_version='1.0.0',
        new_version='1.0.1',
        package_path='sus_packages/crypto-miner',
        package_type='npm'
    )
    
    # Summary
    print("\n" + "📊 SUMMARY".center(60, "="))
    print(f"Package 1 (auth-helper): {result1['action']} - Risk {result1['risk_score']}/100")
    print(f"Package 2 (crypto-miner): {result2['action']} - Risk {result2['risk_score']}/100")
