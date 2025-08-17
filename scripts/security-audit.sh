#!/bin/bash

echo "🔍 Running Security Audit..."
echo "================================="

# Check for npm vulnerabilities
echo "📦 Checking package vulnerabilities..."
npm audit --audit-level moderate

# Check for unused dependencies
echo ""
echo "🧹 Checking for unused dependencies..."
npx depcheck --skip-missing

# Check TypeScript compilation
echo ""
echo "📝 Type checking..."
npx tsc --noEmit

# Lint code
echo ""
echo "🔍 Linting code..."
npx eslint .

# Check for hardcoded secrets (basic patterns)
echo ""
echo "🔐 Checking for potential secrets..."
grep -r "password\|secret\|key\|token" src/ --include="*.ts" --include="*.tsx" | grep -v "// Allow" | head -10

echo ""
echo "✅ Security audit complete!"