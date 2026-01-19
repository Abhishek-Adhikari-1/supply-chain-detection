#!/bin/bash
# Supply Chain Guardian - Sandbox Builder
# Builds and manages the Docker sandbox environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="supply-chain-guardian-sandbox"
CONTAINER_NAME="scg-sandbox"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Supply Chain Guardian - Sandbox Setup${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Build the Docker image
echo -e "${YELLOW}Building sandbox Docker image...${NC}"
docker build -t $IMAGE_NAME "$SCRIPT_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Sandbox image built successfully${NC}"
else
    echo -e "${RED}✗ Failed to build sandbox image${NC}"
    exit 1
fi

# Check if container exists and remove it
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo -e "${YELLOW}Removing existing container...${NC}"
    docker rm -f $CONTAINER_NAME
fi

echo -e "\n${GREEN}Sandbox environment ready!${NC}"
echo -e "${YELLOW}Use ./run_sandbox.sh to test packages${NC}"
