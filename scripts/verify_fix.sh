#!/bin/bash
# Quick verification script for package score inconsistency fix

echo ""
echo "========================================"
echo "🔍 VERIFICATION CHECKLIST"
echo "========================================"
echo ""

# Check Python AI server is running
echo "1️⃣  Python AI Server Status:"
if curl -s http://localhost:8000/health > /dev/null; then
    curl -s http://localhost:8000/health | python3 -m json.tool | grep -E "status|model_loaded"
    echo "   ✅ Server is running"
else
    echo "   ❌ Server is NOT running"
    echo "   Start it with: python3 /home/pr4n4y/Hackathon/ai_server.py"
fi

echo ""
echo "2️⃣  Check Backend Configuration:"
if grep -q "PYTHON_AI_SERVER_URL" /home/pr4n4y/Hackathon/backend/.env 2>/dev/null; then
    echo "   ✅ .env file configured"
    grep "PYTHON_AI_SERVER" /home/pr4n4y/Hackathon/backend/.env
else
    echo "   ⚠️  .env might not have PYTHON_AI_SERVER_URL"
fi

echo ""
echo "3️⃣  Run Package Analysis Test:"
echo "   Execute: python3 /home/pr4n4y/Hackathon/test_ai_server.py"
echo ""
echo "4️⃣  Expected Results:"
echo "   ✅ Different risk scores for different packages"
echo "   ✅ crypto-stealer should have HIGHER score than express"
echo "   ✅ Dev dependencies should have slightly lower scores"
echo ""

echo "========================================"
echo "📝 FILES MODIFIED:"
echo "========================================"
echo ""
echo "✅ /home/pr4n4y/Hackathon/backend/controllers/package.controller.js"
echo "   - Updated parsePackageFile() to include package metadata"
echo "   - Updated scanPackagesWithAI() to use new format"
echo "   - Removed original_content parameter"
echo ""
echo "✅ /home/pr4n4y/Hackathon/ai_server.py"
echo "   - Updated /analyze endpoint to handle package-specific analysis"
echo "   - Enhanced extract_basic_features() with metadata support"
echo "   - Improved calculate_risk_score() with intelligent scoring"
echo "   - Added support for dev dependency flagging"
echo ""
echo "✅ /home/pr4n4y/Hackathon/requirements-ai.txt"
echo "   - Python dependencies for AI server"
echo ""
echo "========================================"
echo ""
