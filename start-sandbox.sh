#!/bin/bash

# 🚀 Sandbox Integration - One-Command Startup
# This script helps you start all services for sandbox testing

set -e

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$PROJECT_ROOT"

echo "🚀 Supply Chain Guardian - Sandbox Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo "${BLUE}Checking prerequisites...${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi
echo "✅ Docker is installed"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi
echo "✅ Node.js is installed"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi
echo "✅ npm is installed"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python3 first."
    exit 1
fi
echo "✅ Python3 is installed"

echo ""

# Option selection
echo "${YELLOW}What would you like to do?${NC}"
echo "1) Check if all dependencies are ready"
echo "2) Build sandbox Docker image (first time only)"
echo "3) Start all services (backend + frontend)"
echo "4) Show quick start guide"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "${BLUE}Checking dependencies...${NC}"
        echo ""
        
        # Check Docker image
        if docker images | grep -q "supply-chain-guardian-sandbox"; then
            echo "✅ Sandbox Docker image is built"
        else
            echo "⚠️  Sandbox Docker image is not built"
            echo "   Run: cd sandbox && ./build_sandbox.sh"
        fi
        
        # Check backend dependencies
        if [ -d "backend/node_modules" ]; then
            echo "✅ Backend dependencies installed"
        else
            echo "⚠️  Backend dependencies not installed"
            echo "   Run: cd backend && npm install"
        fi
        
        # Check frontend dependencies
        if [ -d "frontend/node_modules" ]; then
            echo "✅ Frontend dependencies installed"
        else
            echo "⚠️  Frontend dependencies not installed"
            echo "   Run: cd frontend && npm install"
        fi
        
        # Check socket configuration
        if [ -f "frontend/src/lib/socket.ts" ]; then
            echo "✅ Socket configuration exists"
        else
            echo "❌ Socket configuration missing!"
        fi
        
        # Check UI components
        if [ -f "frontend/src/components/ui/tabs.tsx" ] && [ -f "frontend/src/components/ui/select.tsx" ]; then
            echo "✅ UI components installed"
        else
            echo "❌ UI components missing!"
        fi
        
        # Check Sandbox page
        if [ -f "frontend/src/pages/SandboxPage.tsx" ]; then
            echo "✅ Sandbox page component exists"
        else
            echo "❌ Sandbox page missing!"
        fi
        
        echo ""
        echo "${GREEN}✅ All checks complete!${NC}"
        ;;
        
    2)
        echo ""
        echo "${BLUE}Building Sandbox Docker Image...${NC}"
        echo "This may take a few minutes on first run."
        echo ""
        
        if [ ! -d "sandbox" ]; then
            echo "❌ Sandbox directory not found!"
            exit 1
        fi
        
        cd sandbox
        
        if [ ! -f "build_sandbox.sh" ]; then
            echo "❌ build_sandbox.sh not found!"
            exit 1
        fi
        
        chmod +x build_sandbox.sh
        ./build_sandbox.sh
        
        cd ..
        
        echo ""
        echo "${GREEN}✅ Sandbox image built successfully!${NC}"
        ;;
        
    3)
        echo ""
        echo "${BLUE}Starting all services...${NC}"
        echo ""
        echo "The following will start:"
        echo "1. Backend server on http://localhost:5000"
        echo "2. Frontend dev server on http://localhost:5173"
        echo ""
        echo "Press Ctrl+C to stop services."
        echo ""
        
        # Start backend
        echo "${YELLOW}→ Starting backend...${NC}"
        cd backend
        if [ ! -d "node_modules" ]; then
            echo "  Installing backend dependencies..."
            npm install > /dev/null 2>&1
        fi
        npm run dev &
        BACKEND_PID=$!
        cd ..
        
        sleep 3
        echo "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
        echo ""
        
        # Start frontend
        echo "${YELLOW}→ Starting frontend...${NC}"
        cd frontend
        if [ ! -d "node_modules" ]; then
            echo "  Installing frontend dependencies..."
            npm install > /dev/null 2>&1
        fi
        npm run dev &
        FRONTEND_PID=$!
        cd ..
        
        sleep 3
        echo "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
        echo ""
        
        echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo "${GREEN}✅ All services are running!${NC}"
        echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Backend:  http://localhost:5000"
        echo "Frontend: http://localhost:5173"
        echo ""
        echo "📝 Next steps:"
        echo "  1. Open http://localhost:5173 in your browser"
        echo "  2. Login to your account"
        echo "  3. Click 'Sandbox' in the dashboard"
        echo "  4. Select a package and run a test!"
        echo ""
        echo "Press Ctrl+C to stop all services"
        echo ""
        
        # Wait for processes
        wait $BACKEND_PID $FRONTEND_PID
        ;;
        
    4)
        echo ""
        echo "${GREEN}🚀 QUICK START GUIDE${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Step 1: Build Sandbox (First Time Only)"
        echo "  cd sandbox && ./build_sandbox.sh && cd .."
        echo ""
        echo "Step 2: Start Backend"
        echo "  cd backend && npm run dev"
        echo ""
        echo "Step 3: Start Frontend (New Terminal)"
        echo "  cd frontend && npm run dev"
        echo ""
        echo "Step 4: Open in Browser"
        echo "  http://localhost:5173"
        echo ""
        echo "Step 5: Use Sandbox"
        echo "  - Login"
        echo "  - Click 'Sandbox' in dashboard"
        echo "  - Select a package (e.g., 'auth-helper')"
        echo "  - Click 'Run Sandbox Test'"
        echo "  - Watch real-time results!"
        echo ""
        echo "📚 Documentation:"
        echo "  - SANDBOX_QUICKSTART.md - Quick reference"
        echo "  - SYSTEM_ARCHITECTURE.md - How it works"
        echo "  - INTEGRATION_CHECKLIST.md - Verification"
        echo "  - docs/SANDBOX_WEB_INTEGRATION.md - Full details"
        echo ""
        ;;
        
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
