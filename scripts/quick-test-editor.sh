#!/bin/bash

echo "🔍 TESTING EDITOR PAGE RENDERING"
echo "=================================="
echo ""

# Get project ID
PROJECT_ID=$(docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT id FROM projects ORDER BY created_at DESC LIMIT 1;" | xargs)
echo "✓ Project ID: $PROJECT_ID"
echo ""

# Try to login and get cookie
echo "Attempting login..."
RESPONSE=$(curl -s -c /tmp/dyad_cookies.txt -L \
  -X POST "http://localhost:3000/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=dev1@test.com&password=password&callbackUrl=http://localhost:3000/dashboard")

# Check if cookie exists
if [ -f /tmp/dyad_cookies.txt ]; then
  echo "✓ Cookie file created"
  
  # Try to access editor with cookie
  echo ""
  echo "Fetching editor page..."
  EDITOR_HTML=$(curl -s -b /tmp/dyad_cookies.txt "http://localhost:3000/editor/$PROJECT_ID")
  
  # Check for DyadEditorClient rendering
  if echo "$EDITOR_HTML" | grep -q "Select a file to start editing"; then
    echo "✓ Editor page loaded successfully!"
    echo ""
    
    # Check for specific components
    if echo "$EDITOR_HTML" | grep -qi "AI Assistant\|ChatInterface\|Configure Model"; then
      echo "✅ AI CHAT INTERFACE FOUND!"
    else
      echo "⚠️  AI Chat interface not found in HTML"
    fi
    
    if echo "$EDITOR_HTML" | grep -qi "Active Collaborators"; then
      echo "✓ Collaborators panel found"
    fi
    
    if echo "$EDITOR_HTML" | grep -qi "Files"; then
      echo "✓ Files panel found"
    fi
  else
    echo "❌ Editor page did NOT load correctly"
    echo ""
    echo "Response (first 1000 chars):"
    echo "$EDITOR_HTML" | head -c 1000
  fi
else
  echo "❌ Login failed - no cookie created"
fi

echo ""
echo "=================================="
echo "Please refresh your browser and check:"
echo "http://localhost:3000/editor/$PROJECT_ID"
echo "=================================="

# Cleanup
rm -f /tmp/dyad_cookies.txt
