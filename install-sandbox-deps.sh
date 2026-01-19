#!/bin/bash

# Install missing Radix UI dependencies for Sandbox integration

echo "📦 Installing missing UI dependencies..."

cd frontend

npm install @radix-ui/react-tabs @radix-ui/react-select

echo "✅ Dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Start frontend: cd frontend && npm run dev"
echo "3. Navigate to /sandbox to test the integration"
