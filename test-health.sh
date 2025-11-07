#!/bin/bash

# Phase 1 Health Check Script
# Run this before starting manual testing

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         DYAD COLLABORATIVE - Phase 1 Health Check             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Test 1: Docker Containers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Docker Containers Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

APP_STATUS=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep "dyad-collaborative-app-1")
DB_STATUS=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep "dyad-collaborative-db-1")
REDIS_STATUS=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep "dyad-collaborative-redis-1")

if [ ! -z "$APP_STATUS" ]; then
    echo -e "${GREEN}✓${NC} App Container: $APP_STATUS"
    ((PASS++))
else
    echo -e "${RED}✗${NC} App Container: Not running"
    ((FAIL++))
fi

if [ ! -z "$DB_STATUS" ]; then
    echo -e "${GREEN}✓${NC} Database Container: $DB_STATUS"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Database Container: Not running"
    ((FAIL++))
fi

if [ ! -z "$REDIS_STATUS" ]; then
    echo -e "${GREEN}✓${NC} Redis Container: $REDIS_STATUS"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Redis Container: Not running"
    ((FAIL++))
fi

echo ""

# Test 2: App Responsiveness
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Application Responsiveness"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "404" ] || [ "$HTTP_STATUS" = "307" ]; then
    echo -e "${GREEN}✓${NC} HTTP Endpoint: Responding (Status: $HTTP_STATUS)"
    ((PASS++))
else
    echo -e "${RED}✗${NC} HTTP Endpoint: Not responding (Status: $HTTP_STATUS)"
    ((FAIL++))
fi

echo ""

# Test 3: Database Connection
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Database Connection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DB_TEST=$(docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT 1;" 2>/dev/null | tr -d ' \n')

if [ "$DB_TEST" = "1" ]; then
    echo -e "${GREEN}✓${NC} Database Connection: OK"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Database Connection: Failed"
    ((FAIL++))
fi

echo ""

# Test 4: Project Invitations Table
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Database Schema - project_invitations Table"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TABLE_EXISTS=$(docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_invitations');" 2>/dev/null | tr -d ' \n')

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✓${NC} Table Exists: project_invitations"
    
    # Count columns
    COLUMN_COUNT=$(docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'project_invitations';" 2>/dev/null | tr -d ' \n')
    
    if [ "$COLUMN_COUNT" = "12" ]; then
        echo -e "${GREEN}✓${NC} Column Count: $COLUMN_COUNT (Expected: 12)"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠${NC} Column Count: $COLUMN_COUNT (Expected: 12)"
        ((FAIL++))
    fi
    
    # Count indexes
    INDEX_COUNT=$(docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'project_invitations';" 2>/dev/null | tr -d ' \n')
    echo -e "${GREEN}✓${NC} Index Count: $INDEX_COUNT"
    
    # Count invitations
    INVITATION_COUNT=$(docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT COUNT(*) FROM project_invitations;" 2>/dev/null | tr -d ' \n')
    echo -e "   Current Invitations: $INVITATION_COUNT"
    
    ((PASS++))
else
    echo -e "${RED}✗${NC} Table Not Found: project_invitations"
    ((FAIL++))
fi

echo ""

# Test 5: Required Files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: Required Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FILES=(
    "src/lib/collaboration/invitation-manager.ts"
    "src/lib/email/email-service.ts"
    "src/components/collaboration/InviteCollaboratorModal.tsx"
    "src/components/collaboration/CollaboratorsList.tsx"
    "src/app/invitations/[token]/page.tsx"
    "src/app/api/projects/[projectId]/invitations/route.ts"
)

for FILE in "${FILES[@]}"; do
    if [ -f "$FILE" ]; then
        SIZE=$(wc -c < "$FILE" | tr -d ' ')
        echo -e "${GREEN}✓${NC} $FILE ($SIZE bytes)"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $FILE (Not found)"
        ((FAIL++))
    fi
done

echo ""

# Test 6: API Endpoints
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: API Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test authentication endpoint
AUTH_TEST=$(curl -s http://localhost:3000/api/projects/test-id/invitations 2>/dev/null)
if echo "$AUTH_TEST" | grep -q "Unauthorized"; then
    echo -e "${GREEN}✓${NC} Authentication Check: Working (returns Unauthorized)"
    ((PASS++))
else
    echo -e "${YELLOW}⚠${NC} Authentication Check: Unexpected response"
    echo "   Response: $AUTH_TEST"
    ((FAIL++))
fi

# Test public invitation endpoint
INVITATION_TEST=$(curl -s http://localhost:3000/api/invitations/invalid-token 2>/dev/null)
if echo "$INVITATION_TEST" | grep -q "not found"; then
    echo -e "${GREEN}✓${NC} Public Invitation Endpoint: Working (returns not found)"
    ((PASS++))
else
    echo -e "${YELLOW}⚠${NC} Public Invitation Endpoint: Unexpected response"
    echo "   Response: $INVITATION_TEST"
    ((FAIL++))
fi

echo ""

# Test 7: Recent Logs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 7: Application Logs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ERROR_COUNT=$(docker logs dyad-collaborative-app-1 --tail 100 2>&1 | grep -i "error" | grep -v "No errors" | wc -l | tr -d ' ')

if [ "$ERROR_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✓${NC} Recent Logs: No errors found"
    ((PASS++))
else
    echo -e "${YELLOW}⚠${NC} Recent Logs: Found $ERROR_COUNT error lines"
    echo ""
    echo "   Last 5 errors:"
    docker logs dyad-collaborative-app-1 --tail 100 2>&1 | grep -i "error" | grep -v "No errors" | tail -5 | sed 's/^/   /'
    ((FAIL++))
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL=$((PASS + FAIL))
PASS_RATE=$((PASS * 100 / TOTAL))

echo ""
echo "   Total Tests: $TOTAL"
echo -e "   ${GREEN}Passed: $PASS${NC}"
echo -e "   ${RED}Failed: $FAIL${NC}"
echo "   Pass Rate: $PASS_RATE%"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ✓ ALL SYSTEMS READY FOR TESTING                  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Open testing guide: docs/PHASE_1_MANUAL_TESTING_GUIDE.md"
    echo "2. Open checklist: docs/TESTING_CHECKLIST.md"
    echo "3. Start with Test 2: UI Integration"
    echo ""
    exit 0
else
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║              ⚠ SOME CHECKS FAILED - REVIEW NEEDED             ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Recommended Actions:"
    if [ -z "$APP_STATUS" ]; then
        echo "- Start Docker containers: docker compose up -d"
    fi
    if [ "$COLUMN_COUNT" != "12" ]; then
        echo "- Apply database migration: cat migrations/004_alter_collaboration_invitations.sql | docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative"
    fi
    if [ $ERROR_COUNT -gt 0 ]; then
        echo "- Check application logs: docker logs dyad-collaborative-app-1 --tail 50"
    fi
    echo ""
    exit 1
fi
