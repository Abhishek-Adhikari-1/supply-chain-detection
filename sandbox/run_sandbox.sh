#!/bin/bash
# Supply Chain Guardian - Sandbox Runner
# Executes packages in isolated Docker sandbox

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="supply-chain-guardian-sandbox"
CONTAINER_NAME="scg-sandbox-$$"  # Unique per run

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Usage
usage() {
    echo "Usage: $0 <package_path> [package_type] [timeout]"
    echo ""
    echo "Arguments:"
    echo "  package_path    Path to package directory (relative to project root)"
    echo "  package_type    Type of package: npm or pypi (default: npm)"
    echo "  timeout         Execution timeout in seconds (default: 30)"
    echo ""
    echo "Examples:"
    echo "  $0 sus_packages/auth-helper npm 30"
    echo "  $0 sus_packages/py_backdoor pypi 45"
    exit 1
}

# Check arguments
if [ $# -lt 1 ]; then
    usage
fi

PACKAGE_PATH="$1"
PACKAGE_TYPE="${2:-npm}"
TIMEOUT="${3:-30}"

# Validate package path exists
if [ ! -d "../$PACKAGE_PATH" ]; then
    echo -e "${RED}Error: Package directory not found: $PACKAGE_PATH${NC}"
    exit 1
fi

PACKAGE_NAME=$(basename "$PACKAGE_PATH")

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supply Chain Guardian - Sandbox Test${NC}"
echo -e "${BLUE}========================================${NC}\n"
echo -e "${YELLOW}Package:${NC} $PACKAGE_NAME"
echo -e "${YELLOW}Type:${NC} $PACKAGE_TYPE"
echo -e "${YELLOW}Timeout:${NC} ${TIMEOUT}s"
echo -e "${YELLOW}Path:${NC} $PACKAGE_PATH\n"

# Create results directory on host
RESULTS_DIR="$SCRIPT_DIR/results"
LOGS_DIR="$SCRIPT_DIR/logs"
mkdir -p "$RESULTS_DIR" "$LOGS_DIR"

# Set permissions to allow container user to write
chmod 777 "$RESULTS_DIR" "$LOGS_DIR"

echo -e "${YELLOW}Starting sandbox container...${NC}"

# Run sandbox container
docker run \
    --name "$CONTAINER_NAME" \
    --rm \
    --network none \
    --cap-drop=ALL \
    --cap-add=NET_ADMIN \
    --security-opt=no-new-privileges \
    -e "PACKAGE_NAME=$PACKAGE_NAME" \
    -v "$(cd .. && pwd)/$PACKAGE_PATH:/sandbox/package:ro" \
    -v "$RESULTS_DIR:/sandbox/results:rw" \
    -v "$LOGS_DIR:/sandbox/logs:rw" \
    "$IMAGE_NAME" \
    python /sandbox/sandbox_runner.py /sandbox/package "$PACKAGE_TYPE" "$TIMEOUT"

RUNNER_EXIT=$?

echo -e "\n${YELLOW}Analyzing behavior...${NC}\n"

# Find the latest execution ID
LATEST_RESULT=$(ls -t "$RESULTS_DIR" | grep "_result.json" | head -1)
if [ -z "$LATEST_RESULT" ]; then
    echo -e "${RED}Error: No results found${NC}"
    exit 1
fi

EXECUTION_ID=$(basename "$LATEST_RESULT" | sed 's/_result.json//')

# Run behavior analysis in a new container (needs write access to save analysis)
docker run \
    --rm \
    -v "$RESULTS_DIR:/sandbox/results:rw" \
    -v "$LOGS_DIR:/sandbox/logs:ro" \
    "$IMAGE_NAME" \
    python /sandbox/behavior_analyzer.py "$EXECUTION_ID"

ANALYZER_EXIT=$?

# Display summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Test Complete${NC}"
echo -e "${BLUE}========================================${NC}"

if [ -f "$RESULTS_DIR/${EXECUTION_ID}_analysis.json" ]; then
    RISK_SCORE=$(jq -r '.risk_score' "$RESULTS_DIR/${EXECUTION_ID}_analysis.json")
    THREAT_LEVEL=$(jq -r '.threat_level' "$RESULTS_DIR/${EXECUTION_ID}_analysis.json")
    VERDICT=$(jq -r '.verdict' "$RESULTS_DIR/${EXECUTION_ID}_analysis.json")
    
    echo -e "${YELLOW}Risk Score:${NC} $RISK_SCORE/100"
    echo -e "${YELLOW}Threat Level:${NC} $THREAT_LEVEL"
    echo -e "${YELLOW}Verdict:${NC} $VERDICT"
    
    if [ "$VERDICT" == "MALICIOUS" ]; then
        echo -e "\n${RED}⛔ THREAT DETECTED - BLOCK THIS PACKAGE${NC}"
    elif [ "$VERDICT" == "SUSPICIOUS" ]; then
        echo -e "\n${YELLOW}⚠️  SUSPICIOUS - MANUAL REVIEW REQUIRED${NC}"
    else
        echo -e "\n${GREEN}✓ Package appears safe${NC}"
    fi
else
    echo -e "${RED}Analysis report not found${NC}"
fi

echo -e "\n${YELLOW}Results:${NC} sandbox/results/${EXECUTION_ID}_*"
echo -e "${YELLOW}Logs:${NC} sandbox/logs/${EXECUTION_ID}_*"

exit 0
