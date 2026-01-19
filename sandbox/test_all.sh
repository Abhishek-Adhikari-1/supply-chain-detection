#!/bin/bash
# Test all suspicious packages in the sandbox

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUS_PACKAGES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/sus_packages"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supply Chain Guardian - Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Detect package type
detect_pkg_type() {
    [ -f "$1/setup.py" ] && echo "pypi" && return
    [ -f "$1/__init__.py" ] && echo "pypi" && return
    [ -f "$1/run_backdoor.py" ] && echo "pypi" && return
    [ -f "$1/package.json" ] && echo "npm" && return
    echo ""
}

test_count=0
echo -e "${YELLOW}Discovering packages in: $SUS_PACKAGES_DIR${NC}\n"

# Test each package
for pkg_dir in "$SUS_PACKAGES_DIR"/*/; do
    [ ! -d "$pkg_dir" ] && continue
    
    pkg_name=$(basename "$pkg_dir")
    [[ "$pkg_name" == "README"* ]] && continue
    
    pkg_type=$(detect_pkg_type "$pkg_dir")
    [ -z "$pkg_type" ] && continue
    
    ((test_count++))
    echo -e "${GREEN}$test_count. Testing $pkg_name ($pkg_type)${NC}"
    
    # Run test
    timeout 90 "$SCRIPT_DIR/run_sandbox.sh" "sus_packages/$pkg_name" "$pkg_type" 60 2>&1 | grep -E "(Risk Score|Threat Level|Verdict)" | head -3 | sed 's/^/   /'
    echo ""
done

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "Packages tested: ${GREEN}$test_count${NC}\n"

echo -e "${BLUE}Risk Assessment:${NC}\n"

for analysis in "$SCRIPT_DIR/results"/*_analysis.json; do
    [ ! -f "$analysis" ] && continue
    
    pkg=$(basename "$analysis" | sed 's/_[0-9]*_analysis.json//')
    if command -v jq &>/dev/null; then
        risk=$(jq -r '.risk_score' "$analysis" 2>/dev/null || echo "?")
        threat=$(jq -r '.threat_level' "$analysis" 2>/dev/null || echo "?")
    else
        risk=$(python3 -c "import json; print(json.load(open('$analysis')).get('risk_score', '?'))" 2>/dev/null || echo "?")
        threat=$(python3 -c "import json; print(json.load(open('$analysis')).get('threat_level', '?'))" 2>/dev/null || echo "?")
    fi
    
    case "$threat" in
        CRITICAL) echo -e "${RED}🚨 $pkg: $risk/100 - CRITICAL${NC}" ;;
        MEDIUM)   echo -e "${YELLOW}⚠️  $pkg: $risk/100 - MEDIUM${NC}" ;;
        *)        echo -e "${GREEN}✓ $pkg: $risk/100 - $threat${NC}" ;;
    esac
done | sort -u

echo ""
echo -e "${BLUE}Files:${NC}"
echo -e "  Results: $SCRIPT_DIR/results/"
echo -e "  Logs:    $SCRIPT_DIR/logs/"
