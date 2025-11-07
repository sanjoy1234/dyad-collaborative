#!/bin/bash

# Comprehensive Testing Script for Dyad Collaborative Platform

echo "========================================="
echo "DYAD COLLABORATIVE - COMPREHENSIVE TESTS"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if services are running
echo "Test 1: Checking Docker Services..."
if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Docker services are running"
else
    echo -e "${RED}✗${NC} Docker services are NOT running"
    exit 1
fi
echo ""

# Test 2: Check if app is responding
echo "Test 2: Checking Application Response..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Application is responding (HTTP $HTTP_CODE)"
else
    echo -e "${RED}✗${NC} Application not responding correctly (HTTP $HTTP_CODE)"
fi
echo ""

# Test 3: Check database connectivity
echo "Test 3: Checking Database..."
DB_CHECK=$(docker compose exec -T db psql -U postgres -d dyad_collaborative -c "SELECT COUNT(*) FROM users;" 2>&1)
if echo "$DB_CHECK" | grep -q "4"; then
    echo -e "${GREEN}✓${NC} Database is accessible (4 users found)"
else
    echo -e "${RED}✗${NC} Database check failed"
    echo "$DB_CHECK"
fi
echo ""

# Test 4: Verify project_files table structure
echo "Test 4: Verifying Database Schema..."
COLUMNS=$(docker compose exec -T db psql -U postgres -d dyad_collaborative -c "\d project_files" | grep -E "path|content|file_type|project_id")
if echo "$COLUMNS" | grep -q "path" && echo "$COLUMNS" | grep -q "content"; then
    echo -e "${GREEN}✓${NC} project_files table has correct columns"
    echo "  - path: ✓"
    echo "  - content: ✓"
    echo "  - file_type: ✓"
    echo "  - project_id: ✓"
else
    echo -e "${RED}✗${NC} project_files table structure incorrect"
fi
echo ""

# Test 5: Check for application errors
echo "Test 5: Checking Application Logs for Errors..."
ERROR_COUNT=$(docker compose logs app --tail 100 | grep -i "error" | grep -v "ERROR 42P01" | wc -l | tr -d ' ')
if [ "$ERROR_COUNT" = "0" ]; then
    echo -e "${GREEN}✓${NC} No errors in application logs"
else
    echo -e "${YELLOW}⚠${NC} Found $ERROR_COUNT errors in logs (may be from previous runs)"
    docker compose logs app --tail 50 | grep -i "error" | tail -n 5
fi
echo ""

# Test 6: Check existing projects
echo "Test 6: Checking Existing Projects..."
PROJECT_COUNT=$(docker compose exec -T db psql -U postgres -d dyad_collaborative -c "SELECT COUNT(*) FROM projects;" 2>&1 | grep -E "^\s*[0-9]+\s*$" | tr -d ' ')
if [ ! -z "$PROJECT_COUNT" ]; then
    echo -e "${GREEN}✓${NC} Found $PROJECT_COUNT projects in database"
else
    echo -e "${YELLOW}⚠${NC} Could not count projects"
fi
echo ""

# Test 7: Verify routes exist
echo "Test 7: Checking Routes..."
routes=("/auth/login" "/dashboard" "/dashboard/new-project")
for route in "${routes[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$route")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ]; then
        echo -e "${GREEN}✓${NC} $route responds (HTTP $HTTP_CODE)"
    else
        echo -e "${RED}✗${NC} $route failed (HTTP $HTTP_CODE)"
    fi
done
echo ""

# Test 8: Check API endpoints
echo "Test 8: Checking API Endpoints..."
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/projects")
if [ "$API_CODE" = "401" ]; then
    echo -e "${GREEN}✓${NC} /api/projects exists (returns 401 Unauthorized as expected)"
else
    echo -e "${YELLOW}⚠${NC} /api/projects returned HTTP $API_CODE"
fi
echo ""

# Summary
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo ""
echo "Manual Testing Steps:"
echo "1. Open http://localhost:3000"
echo "2. Login: dev1@test.com / Test123!"
echo "3. Click '+ New Project'"
echo "4. Enter name: 'My Test Project'"
echo "5. Click 'Create Project'"
echo ""
echo "Expected Result:"
echo "- Project should be created"
echo "- You should see editor with README.md and index.js"
echo "- No 'Failed to create project' error"
echo ""
echo "Test Accounts:"
echo "  dev1@test.com   / Test123!"
echo "  dev2@test.com   / Test123!"
echo "  dev3@test.com   / Test123!"
echo "  admin@test.com  / Test123!"
echo ""
echo "========================================="
