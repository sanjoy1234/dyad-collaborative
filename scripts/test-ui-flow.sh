#!/bin/bash

echo "================================="
echo "🧪 DYAD UI FLOW TEST"
echo "================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check if app is running
echo -e "${BLUE}Test 1: Check if application is accessible${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_CODE" == "307" ] || [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✓ App is running (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ App is not accessible (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Test 2: Try to login
echo -e "${BLUE}Test 2: Attempt login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=dev1@test.com&password=password&callbackUrl=http://localhost:3000/dashboard" \
  -c /tmp/cookies.txt \
  -L -w "\n%{http_code}")

echo "$LOGIN_RESPONSE" | tail -n 1
if echo "$LOGIN_RESPONSE" | grep -q "200\|302\|307"; then
    echo -e "${GREEN}✓ Login endpoint responded${NC}"
else
    echo -e "${YELLOW}⚠ Login may have issues${NC}"
fi
echo ""

# Test 3: Get session cookie
echo -e "${BLUE}Test 3: Check session cookie${NC}"
if [ -f /tmp/cookies.txt ]; then
    COOKIE=$(grep "next-auth.session-token" /tmp/cookies.txt | awk '{print $7}')
    if [ ! -z "$COOKIE" ]; then
        echo -e "${GREEN}✓ Session cookie obtained${NC}"
        echo "Cookie: ${COOKIE:0:50}..."
    else
        echo -e "${YELLOW}⚠ No session cookie found${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No cookie file created${NC}"
fi
echo ""

# Test 4: Get project ID
echo -e "${BLUE}Test 4: Get a project ID from database${NC}"
PROJECT_ID=$(docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT id FROM projects ORDER BY created_at DESC LIMIT 1;" | xargs)
if [ ! -z "$PROJECT_ID" ]; then
    echo -e "${GREEN}✓ Project found: $PROJECT_ID${NC}"
else
    echo -e "${RED}✗ No projects in database${NC}"
    exit 1
fi
echo ""

# Test 5: Try to access editor page
echo -e "${BLUE}Test 5: Access editor page${NC}"
if [ -f /tmp/cookies.txt ]; then
    EDITOR_HTML=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/editor/$PROJECT_ID")
    
    # Check for key elements
    if echo "$EDITOR_HTML" | grep -q "AI Assistant\|ChatInterface\|Type your prompt"; then
        echo -e "${GREEN}✓ Editor page contains AI chat elements!${NC}"
        echo ""
        echo "Found elements:"
        echo "$EDITOR_HTML" | grep -o "AI Assistant\|ChatInterface\|Type your prompt" | sort -u
    else
        echo -e "${RED}✗ Editor page does NOT contain AI chat elements${NC}"
        echo ""
        echo "HTML Preview (first 500 chars):"
        echo "$EDITOR_HTML" | head -c 500
    fi
else
    echo -e "${YELLOW}⚠ No cookies available for authenticated request${NC}"
fi
echo ""

# Test 6: Check if ChatInterface component exists
echo -e "${BLUE}Test 6: Verify ChatInterface component exists${NC}"
if [ -f "src/components/ai/ChatInterface.tsx" ]; then
    LINE_COUNT=$(wc -l < src/components/ai/ChatInterface.tsx)
    echo -e "${GREEN}✓ ChatInterface.tsx exists ($LINE_COUNT lines)${NC}"
    
    # Check for key features
    if grep -q "Type your prompt\|textarea" src/components/ai/ChatInterface.tsx; then
        echo -e "${GREEN}✓ Contains prompt input${NC}"
    fi
    if grep -q "handleSend\|onClick" src/components/ai/ChatInterface.tsx; then
        echo -e "${GREEN}✓ Contains send functionality${NC}"
    fi
else
    echo -e "${RED}✗ ChatInterface.tsx not found${NC}"
fi
echo ""

# Test 7: Check DyadEditorClient renders ChatInterface
echo -e "${BLUE}Test 7: Verify DyadEditorClient renders ChatInterface${NC}"
if grep -q "ChatInterface" src/components/editor/DyadEditorClient.tsx; then
    echo -e "${GREEN}✓ DyadEditorClient imports ChatInterface${NC}"
    
    # Check if rightPanelOpen is true by default
    if grep "rightPanelOpen.*useState(true)" src/components/editor/DyadEditorClient.tsx; then
        echo -e "${GREEN}✓ Right panel is OPEN by default${NC}"
    else
        echo -e "${YELLOW}⚠ Right panel might be closed by default${NC}"
    fi
else
    echo -e "${RED}✗ DyadEditorClient does NOT use ChatInterface${NC}"
fi
echo ""

# Summary
echo "================================="
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "================================="
echo ""
echo "Next steps:"
echo "1. Open browser: http://localhost:3000"
echo "2. Login: dev1@test.com / password"
echo "3. Click any project card"
echo "4. Look for the RIGHT PANEL with 'AI Assistant'"
echo ""
echo "If you DON'T see it:"
echo "- Open DevTools (F12)"
echo "- Go to Console tab"
echo "- Share any errors you see"
echo ""

# Cleanup
rm -f /tmp/cookies.txt
