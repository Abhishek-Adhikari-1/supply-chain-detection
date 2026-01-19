#!/usr/bin/env python3
"""
Supply Chain Guardian - Obfuscation Detector
Detects code obfuscation patterns in package source code
"""

import re
import ast
import json
from pathlib import Path
from typing import Dict, List, Tuple


class ObfuscationDetector:
    """Detects various code obfuscation techniques"""
    
    def __init__(self, package_path: Path):
        self.package_path = Path(package_path)
        self.obfuscation_score = 0
        self.findings = []
        
    def analyze_javascript(self, content: str) -> Dict:
        """Analyze JavaScript code for obfuscation patterns"""
        findings = []
        score = 0
        
        # 1. Base64 encoding detection
        base64_pattern = r'(?:atob|btoa|Buffer\.from)\s*\('
        base64_matches = len(re.findall(base64_pattern, content, re.IGNORECASE))
        if base64_matches > 0:
            findings.append({
                'type': 'base64_encoding',
                'severity': 'high',
                'count': base64_matches,
                'message': f'Found {base64_matches} base64 encoding operations'
            })
            score += min(base64_matches * 10, 30)
        
        # 2. Hex string patterns (long hex strings often indicate obfuscation)
        hex_pattern = r'\\x[0-9a-fA-F]{2}'
        hex_matches = len(re.findall(hex_pattern, content))
        if hex_matches > 10:
            findings.append({
                'type': 'hex_encoding',
                'severity': 'high',
                'count': hex_matches,
                'message': f'Found {hex_matches} hex-encoded characters'
            })
            score += min(hex_matches // 2, 25)
        
        # 3. eval() usage (code execution from strings)
        eval_pattern = r'\beval\s*\('
        eval_matches = len(re.findall(eval_pattern, content))
        if eval_matches > 0:
            findings.append({
                'type': 'eval_usage',
                'severity': 'critical',
                'count': eval_matches,
                'message': f'Found {eval_matches} eval() calls (dynamic code execution)'
            })
            score += eval_matches * 20
        
        # 4. Function constructor (indirect eval)
        func_constructor = r'new\s+Function\s*\('
        func_matches = len(re.findall(func_constructor, content))
        if func_matches > 0:
            findings.append({
                'type': 'function_constructor',
                'severity': 'critical',
                'count': func_matches,
                'message': f'Found {func_matches} Function() constructor calls'
            })
            score += func_matches * 20
        
        # 5. String concatenation obfuscation (lots of + operators in strings)
        concat_pattern = r'["\'][^"\']{1,3}["\'](\s*\+\s*["\'][^"\']{1,3}["\']){5,}'
        concat_matches = len(re.findall(concat_pattern, content))
        if concat_matches > 0:
            findings.append({
                'type': 'string_concatenation',
                'severity': 'medium',
                'count': concat_matches,
                'message': f'Found {concat_matches} heavily concatenated strings'
            })
            score += min(concat_matches * 5, 15)
        
        # 6. Single-letter variable names (indicator of minification/obfuscation)
        single_var_pattern = r'\b[a-z]\s*='
        single_vars = len(re.findall(single_var_pattern, content))
        total_lines = content.count('\n') + 1
        if total_lines > 50 and single_vars > total_lines * 0.3:
            findings.append({
                'type': 'minified_code',
                'severity': 'medium',
                'count': single_vars,
                'message': f'Heavy use of single-letter variables ({single_vars} found)'
            })
            score += 15
        
        # 7. Unicode escape sequences
        unicode_pattern = r'\\u[0-9a-fA-F]{4}'
        unicode_matches = len(re.findall(unicode_pattern, content))
        if unicode_matches > 10:
            findings.append({
                'type': 'unicode_obfuscation',
                'severity': 'medium',
                'count': unicode_matches,
                'message': f'Found {unicode_matches} unicode escape sequences'
            })
            score += min(unicode_matches // 3, 15)
        
        # 8. String.fromCharCode (character code obfuscation)
        charcode_pattern = r'String\.fromCharCode\s*\('
        charcode_matches = len(re.findall(charcode_pattern, content))
        if charcode_matches > 0:
            findings.append({
                'type': 'charcode_obfuscation',
                'severity': 'high',
                'count': charcode_matches,
                'message': f'Found {charcode_matches} String.fromCharCode() calls'
            })
            score += charcode_matches * 15
        
        # 9. Obfuscated property access (bracket notation abuse)
        bracket_pattern = r'\[["\'][a-zA-Z_][a-zA-Z0-9_]*["\']\]'
        bracket_matches = len(re.findall(bracket_pattern, content))
        if bracket_matches > 20:
            findings.append({
                'type': 'bracket_obfuscation',
                'severity': 'medium',
                'count': bracket_matches,
                'message': f'Excessive bracket notation for property access ({bracket_matches})'
            })
            score += min(bracket_matches // 5, 10)
        
        # 10. Long lines (often indicator of minified/packed code)
        long_lines = sum(1 for line in content.split('\n') if len(line) > 300)
        if long_lines > 0:
            findings.append({
                'type': 'long_lines',
                'severity': 'low',
                'count': long_lines,
                'message': f'{long_lines} extremely long lines (>300 chars)'
            })
            score += min(long_lines * 3, 10)
        
        return {
            'score': min(score, 100),
            'findings': findings
        }
    
    def analyze_python(self, content: str) -> Dict:
        """Analyze Python code for obfuscation patterns"""
        findings = []
        score = 0
        
        # 1. Base64 encoding
        base64_pattern = r'base64\.(b64decode|b64encode|decodebytes)'
        base64_matches = len(re.findall(base64_pattern, content))
        if base64_matches > 0:
            findings.append({
                'type': 'base64_encoding',
                'severity': 'high',
                'count': base64_matches,
                'message': f'Found {base64_matches} base64 encoding operations'
            })
            score += min(base64_matches * 10, 30)
        
        # 2. exec() and eval() usage
        exec_pattern = r'\b(exec|eval)\s*\('
        exec_matches = len(re.findall(exec_pattern, content))
        if exec_matches > 0:
            findings.append({
                'type': 'exec_eval_usage',
                'severity': 'critical',
                'count': exec_matches,
                'message': f'Found {exec_matches} exec/eval calls (dynamic code execution)'
            })
            score += exec_matches * 25
        
        # 3. compile() function (bytecode compilation)
        compile_pattern = r'\bcompile\s*\('
        compile_matches = len(re.findall(compile_pattern, content))
        if compile_matches > 0:
            findings.append({
                'type': 'compile_usage',
                'severity': 'high',
                'count': compile_matches,
                'message': f'Found {compile_matches} compile() calls'
            })
            score += compile_matches * 15
        
        # 4. __import__ dynamic imports
        import_pattern = r'__import__\s*\('
        import_matches = len(re.findall(import_pattern, content))
        if import_matches > 1:  # 1 might be legitimate
            findings.append({
                'type': 'dynamic_imports',
                'severity': 'medium',
                'count': import_matches,
                'message': f'Found {import_matches} __import__() calls'
            })
            score += import_matches * 10
        
        # 5. Hex/octal literals
        hex_pattern = r'\\x[0-9a-fA-F]{2}'
        hex_matches = len(re.findall(hex_pattern, content))
        if hex_matches > 10:
            findings.append({
                'type': 'hex_encoding',
                'severity': 'medium',
                'count': hex_matches,
                'message': f'Found {hex_matches} hex-encoded characters'
            })
            score += min(hex_matches // 2, 20)
        
        # 6. chr() function (character code obfuscation)
        chr_pattern = r'\bchr\s*\('
        chr_matches = len(re.findall(chr_pattern, content))
        if chr_matches > 5:
            findings.append({
                'type': 'chr_obfuscation',
                'severity': 'medium',
                'count': chr_matches,
                'message': f'Found {chr_matches} chr() calls'
            })
            score += min(chr_matches * 2, 15)
        
        # 7. getattr/setattr abuse (hiding attribute access)
        attr_pattern = r'\b(getattr|setattr|hasattr)\s*\('
        attr_matches = len(re.findall(attr_pattern, content))
        if attr_matches > 10:
            findings.append({
                'type': 'attribute_obfuscation',
                'severity': 'medium',
                'count': attr_matches,
                'message': f'Excessive use of getattr/setattr ({attr_matches})'
            })
            score += min(attr_matches // 2, 15)
        
        # 8. String concatenation with join
        join_pattern = r'["\']\.join\('
        join_matches = len(re.findall(join_pattern, content))
        if join_matches > 10:
            findings.append({
                'type': 'string_obfuscation',
                'severity': 'low',
                'count': join_matches,
                'message': f'Heavy use of string join operations ({join_matches})'
            })
            score += min(join_matches // 3, 10)
        
        # 9. marshal/pickle usage (serialized code)
        marshal_pattern = r'\b(marshal|pickle)\.(loads|dumps)'
        marshal_matches = len(re.findall(marshal_pattern, content))
        if marshal_matches > 0:
            findings.append({
                'type': 'serialized_code',
                'severity': 'high',
                'count': marshal_matches,
                'message': f'Found {marshal_matches} marshal/pickle operations'
            })
            score += marshal_matches * 20
        
        # 10. ROT13/codecs obfuscation
        rot13_pattern = r'codecs\.(encode|decode)|rot_13'
        rot13_matches = len(re.findall(rot13_pattern, content, re.IGNORECASE))
        if rot13_matches > 0:
            findings.append({
                'type': 'encoding_obfuscation',
                'severity': 'medium',
                'count': rot13_matches,
                'message': f'Found {rot13_matches} encoding/codec operations'
            })
            score += rot13_matches * 10
        
        return {
            'score': min(score, 100),
            'findings': findings
        }
    
    def scan_package(self) -> Dict:
        """Scan all files in package for obfuscation"""
        all_findings = []
        total_score = 0
        files_scanned = 0
        
        # Scan JavaScript files
        for js_file in self.package_path.rglob('*.js'):
            if 'node_modules' in str(js_file):
                continue
            try:
                content = js_file.read_text(errors='ignore')
                result = self.analyze_javascript(content)
                if result['findings']:
                    all_findings.extend([
                        {**f, 'file': str(js_file.relative_to(self.package_path))}
                        for f in result['findings']
                    ])
                    total_score += result['score']
                    files_scanned += 1
            except Exception as e:
                pass
        
        # Scan Python files
        for py_file in self.package_path.rglob('*.py'):
            if '__pycache__' in str(py_file):
                continue
            try:
                content = py_file.read_text(errors='ignore')
                result = self.analyze_python(content)
                if result['findings']:
                    all_findings.extend([
                        {**f, 'file': str(py_file.relative_to(self.package_path))}
                        for f in result['findings']
                    ])
                    total_score += result['score']
                    files_scanned += 1
            except Exception as e:
                pass
        
        # Normalize score (average across files, capped at 100)
        if files_scanned > 0:
            avg_score = total_score // files_scanned
        else:
            avg_score = 0
        
        # Classify obfuscation level
        if avg_score >= 70:
            level = 'CRITICAL'
            verdict = 'Heavily obfuscated - likely malicious'
        elif avg_score >= 40:
            level = 'HIGH'
            verdict = 'Moderately obfuscated - suspicious'
        elif avg_score >= 20:
            level = 'MEDIUM'
            verdict = 'Some obfuscation detected'
        else:
            level = 'LOW'
            verdict = 'Minimal or no obfuscation'
        
        return {
            'obfuscation_score': min(avg_score, 100),
            'threat_level': level,
            'verdict': verdict,
            'files_scanned': files_scanned,
            'findings': all_findings,
            'finding_count': len(all_findings)
        }


def main():
    """CLI entry point"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: obfuscation_detector.py <package_path>")
        sys.exit(1)
    
    package_path = Path(sys.argv[1])
    detector = ObfuscationDetector(package_path)
    result = detector.scan_package()
    
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
