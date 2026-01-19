#!/bin/bash
# Test all suspicious packages in the sandbox

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testing All Suspicious Packages${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test npm packages
echo -e "${YELLOW}Testing npm packages...${NC}\n"

echo -e "${GREEN}1. Testing auth-helper${NC}"
"$SCRIPT_DIR/run_sandbox.sh" sus_packages/auth-helper npm 300
echo ""

echo -e "${GREEN}2. Testing crypto-miner${NC}"
"$SCRIPT_DIR/run_sandbox.sh" sus_packages/crypto-miner npm 300
echo ""

# Test Python packages
echo -e "${YELLOW}Testing Python packages...${NC}\n"

echo -e "${GREEN}3. Testing py_backdoor${NC}"
"$SCRIPT_DIR/run_sandbox.sh" sus_packages/py_backdoor pypi 300
echo ""

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}All Tests Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Check sandbox/results/ for detailed reports${NC}"
