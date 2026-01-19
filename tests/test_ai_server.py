#!/usr/bin/env python3
"""
Test the Python AI server with sample packages
Demonstrates that each package now gets individual risk scores
"""

import requests
import json

# Sample package data from a package.json file
test_packages = [
    {
        "name": "express",
        "version": "4.18.2",
        "isDev": False,
        "ecosystem": "npm",
        "projectContext": {
            "projectName": "my-app",
            "totalDeps": 25,
            "totalDevDeps": 12
        }
    },
    {
        "name": "crypto-stealer",  # Suspicious name
        "version": "1.0.0",
        "isDev": False,
        "ecosystem": "npm",
        "projectContext": {
            "projectName": "my-app",
            "totalDeps": 25,
            "totalDevDeps": 12
        }
    },
    {
        "name": "lodash",
        "version": "4.17.21",
        "isDev": True,
        "ecosystem": "npm",
        "projectContext": {
            "projectName": "my-app",
            "totalDeps": 25,
            "totalDevDeps": 12
        }
    },
    {
        "name": "jest",
        "version": "29.5.0",
        "isDev": True,
        "ecosystem": "npm",
        "projectContext": {
            "projectName": "my-app",
            "totalDeps": 25,
            "totalDevDeps": 12
        }
    },
]

def test_ai_server():
    """Test the AI server with sample packages."""
    
    print("\n" + "="*70)
    print("🧪 TESTING PYTHON AI SERVER - PACKAGE ANALYSIS")
    print("="*70)
    
    # Test health
    print("\n1️⃣  Checking server health...")
    try:
        health_response = requests.get('http://localhost:8000/health', timeout=5)
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"   ✅ Server is running")
            print(f"   ✅ Model loaded: {health_data['model_loaded']}")
            print(f"   ✅ Model accuracy: {health_data['model_accuracy']}%")
        else:
            print(f"   ❌ Server error: {health_response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Cannot reach server: {e}")
        return
    
    # Test analysis
    print("\n2️⃣  Analyzing packages...")
    print(f"   📦 Testing with {len(test_packages)} packages")
    
    try:
        response = requests.post(
            'http://localhost:8000/analyze',
            json={'packages': test_packages},
            timeout=10
        )
        
        if response.status_code == 200:
            results = response.json()
            
            print(f"\n   ✅ Analysis complete!")
            print(f"   📊 Results for {len(results['results'])} packages:\n")
            
            # Display results
            print("   " + "─" * 66)
            print(f"   {'Package':<20} {'Version':<12} {'Dev':<5} {'Risk Score':<12} {'Level':<10}")
            print("   " + "─" * 66)
            
            for result in results['results']:
                pkg_name = result['package'][:19]
                version = result['version'][:11]
                is_dev = "Yes" if result['isDev'] else "No"
                score = result['riskScore']
                level = result['riskLevel'].upper()
                
                # Color coding for risk level
                if level == "CRITICAL":
                    color = "🔴"
                elif level == "HIGH":
                    color = "🟠"
                elif level == "MEDIUM":
                    color = "🟡"
                else:
                    color = "🟢"
                
                print(f"   {pkg_name:<20} {version:<12} {is_dev:<5} {score:<12} {color} {level:<8}")
                
                # Show issues if any
                if result['issues']:
                    for issue in result['issues']:
                        print(f"      ⚠️  {issue}")
            
            print("   " + "─" * 66)
            
            # Show that scores are different
            scores = [r['riskScore'] for r in results['results']]
            if len(set(scores)) > 1:
                print(f"\n   ✅ PASS: Packages have different risk scores (not all the same!)")
                print(f"   📊 Score distribution: {min(scores)} - {max(scores)}")
            else:
                print(f"\n   ❌ FAIL: All packages have the same score ({scores[0]})")
            
        else:
            print(f"   ❌ API error: {response.status_code}")
            print(f"   {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    test_ai_server()
