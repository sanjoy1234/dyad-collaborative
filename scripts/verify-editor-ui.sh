#!/bin/bash

# Test script to verify the editor UI is accessible

echo "==================================="
echo "Dyad Editor UI Verification Test"
echo "==================================="
echo ""

# 1. Check if app is running
echo "1. Checking if application is running..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$STATUS" = "307" ] || [ "$STATUS" = "200" ]; then
    echo "✓ Application is running (HTTP $STATUS)"
else
    echo "✗ Application not accessible (HTTP $STATUS)"
    exit 1
fi

# 2. Check if editor route exists
echo ""
echo "2. Checking editor routes..."
# Get a project ID from database
PROJECT_ID=$(docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT id FROM projects LIMIT 1;" | tr -d ' ' | head -1)

if [ -z "$PROJECT_ID" ]; then
    echo "✗ No projects found in database"
    echo "  Creating a test project..."
    # Create a test project would require authentication
    echo "  Please create a project from the UI first"
    exit 1
else
    echo "✓ Found project: $PROJECT_ID"
fi

# 3. Check if editor page responds
echo ""
echo "3. Testing editor page accessibility..."
EDITOR_URL="http://localhost:3000/editor/$PROJECT_ID"
EDITOR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$EDITOR_URL")

if [ "$EDITOR_STATUS" = "307" ]; then
    echo "✓ Editor page redirects (needs authentication)"
    echo "  URL: $EDITOR_URL"
elif [ "$EDITOR_STATUS" = "200" ]; then
    echo "✓ Editor page loads successfully"
    echo "  URL: $EDITOR_URL"
else
    echo "✗ Editor page returned HTTP $EDITOR_STATUS"
fi

# 4. Check if DyadEditorClient component exists
echo ""
echo "4. Checking if DyadEditorClient component exists..."
if [ -f "src/components/editor/DyadEditorClient.tsx" ]; then
    echo "✓ DyadEditorClient.tsx found"
    LINES=$(wc -l < src/components/editor/DyadEditorClient.tsx)
    echo "  File size: $LINES lines"
else
    echo "✗ DyadEditorClient.tsx NOT FOUND"
    exit 1
fi

# 5. Check if AI components exist
echo ""
echo "5. Checking AI components..."
for component in "ModelConfigModal" "ChatInterface" "CodeDiffViewer"; do
    FILE="src/components/ai/${component}.tsx"
    if [ -f "$FILE" ]; then
        LINES=$(wc -l < "$FILE")
        echo "✓ $component found ($LINES lines)"
    else
        echo "✗ $component NOT FOUND"
    fi
done

# 6. Check database for projects and files
echo ""
echo "6. Checking database content..."
PROJECT_COUNT=$(docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT COUNT(*) FROM projects;" | tr -d ' ')
echo "  Projects in database: $PROJECT_COUNT"

FILE_COUNT=$(docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT COUNT(*) FROM project_files;" | tr -d ' ')
echo "  Project files in database: $FILE_COUNT"

# 7. Summary
echo ""
echo "==================================="
echo "SUMMARY"
echo "==================================="
echo ""
echo "To use the AI editor:"
echo "1. Go to http://localhost:3000/dashboard"
echo "2. Click on a project card"
echo "3. You should see the 3-panel editor with:"
echo "   - Left: File explorer"
echo "   - Center: Preview/Code/Diff tabs"
echo "   - Right: AI Chat interface"
echo ""
echo "If the editor doesn't load:"
echo "- Check browser console for errors (F12)"
echo "- Check Docker logs: docker logs dyad-collaborative-app-1"
echo "- Verify you're logged in"
echo ""
