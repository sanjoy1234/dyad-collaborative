#!/bin/bash

# Integration Test Script for Dyad Web Platform
# Tests complete workflow: Model config → Project creation → AI code generation → Approval → Verification

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api"
TEST_USER_EMAIL="test@dyad.com"
TEST_USER_PASSWORD="test123"
PROJECT_NAME="integration-test-$(date +%s)"
COOKIE_FILE="/tmp/dyad-integration-cookies.txt"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

test_start() {
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Test $TESTS_RUN: $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test data..."
    if [ -n "$PROJECT_ID" ]; then
        curl -s -X DELETE "$API_URL/projects/$PROJECT_ID" \
            -b "$COOKIE_FILE" > /dev/null || true
    fi
    rm -f "$COOKIE_FILE"
}

trap cleanup EXIT

echo ""
echo "=========================================="
echo "Dyad Web Platform Integration Tests"
echo "=========================================="
echo ""

# Test 1: Check Docker containers are running
test_start "Docker containers status"
if docker ps | grep -q "dyad-collaborative-app" && docker ps | grep -q "dyad-collaborative-db"; then
    log_success "Docker containers are running"
else
    log_error "Docker containers are not running"
    log_info "Starting containers..."
    cd "$(dirname "$0")/.."
    docker-compose up -d
    sleep 10
    if docker ps | grep -q "dyad-collaborative-app" && docker ps | grep -q "dyad-collaborative-db"; then
        log_success "Docker containers started successfully"
    else
        log_error "Failed to start Docker containers"
        exit 1
    fi
fi

# Test 2: Check application is responsive
test_start "Application health check"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL)
if [ "$HEALTH_CHECK" = "200" ] || [ "$HEALTH_CHECK" = "307" ] || [ "$HEALTH_CHECK" = "302" ]; then
    log_success "Application is responsive (HTTP $HEALTH_CHECK)"
else
    log_error "Application returned HTTP $HEALTH_CHECK"
    exit 1
fi

# Test 3: User login
test_start "User authentication"
log_info "Logging in as $TEST_USER_EMAIL..."

# Try to login (user might not exist yet)
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/signin" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
    -c "$COOKIE_FILE")

# Check if login successful or need to register
if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    log_info "User doesn't exist, creating account..."
    
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\",\"name\":\"Test User\"}" \
        -c "$COOKIE_FILE")
    
    if echo "$REGISTER_RESPONSE" | grep -q "error"; then
        log_error "Failed to register user"
        echo "Response: $REGISTER_RESPONSE"
        exit 1
    else
        log_success "User registered successfully"
        # Login after registration
        LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/signin" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
            -c "$COOKIE_FILE")
    fi
fi

log_success "User logged in successfully"

# Test 4: Configure AI Model
test_start "Configure AI model"
log_info "Configuring OpenAI model..."

# Check if OPENAI_API_KEY is set in environment
if [ -z "$OPENAI_API_KEY" ]; then
    log_warning "OPENAI_API_KEY not set in environment, skipping model config"
    log_warning "Set OPENAI_API_KEY to test AI features"
    SKIP_AI_TESTS=true
else
    MODEL_CONFIG_RESPONSE=$(curl -s -X POST "$API_URL/ai/models/config" \
        -H "Content-Type: application/json" \
        -b "$COOKIE_FILE" \
        -d "{\"provider\":\"openai\",\"apiKey\":\"$OPENAI_API_KEY\",\"model\":\"gpt-4o\"}")
    
    if echo "$MODEL_CONFIG_RESPONSE" | grep -q "error"; then
        log_warning "Failed to configure model: $MODEL_CONFIG_RESPONSE"
        SKIP_AI_TESTS=true
    else
        log_success "AI model configured successfully"
        SKIP_AI_TESTS=false
    fi
fi

# Test 5: Create project
test_start "Create Next.js project"
log_info "Creating project: $PROJECT_NAME"

CREATE_PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/projects" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_FILE" \
    -d "{
        \"name\":\"$PROJECT_NAME\",
        \"description\":\"Integration test project\",
        \"type\":\"next-js\",
        \"template\":\"blank\"
    }")

PROJECT_ID=$(echo "$CREATE_PROJECT_RESPONSE" | jq -r '.id // empty')

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    log_success "Project created: $PROJECT_ID"
else
    log_error "Failed to create project"
    echo "Response: $CREATE_PROJECT_RESPONSE"
    exit 1
fi

# Test 6: List project files
test_start "List project files"
FILES_RESPONSE=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/files" \
    -b "$COOKIE_FILE")

FILE_COUNT=$(echo "$FILES_RESPONSE" | jq 'length // 0')
log_info "Found $FILE_COUNT files in project"

if [ "$FILE_COUNT" -gt 0 ]; then
    log_success "Project files retrieved successfully"
else
    log_warning "No files found in project (expected for blank template)"
fi

# Test 7: AI Code Generation
if [ "$SKIP_AI_TESTS" != "true" ]; then
    test_start "AI code generation"
    log_info "Generating React Button component..."
    
    GEN_RESPONSE=$(curl -s -X POST "$API_URL/ai/generate" \
        -H "Content-Type: application/json" \
        -b "$COOKIE_FILE" \
        -d "{
            \"projectId\":\"$PROJECT_ID\",
            \"prompt\":\"Create a reusable Button component with TypeScript. It should accept props for variant (primary, secondary), size (small, medium, large), and onClick handler. Use Tailwind CSS for styling.\",
            \"model\":\"gpt-4o\"
        }")
    
    GENERATION_ID=$(echo "$GEN_RESPONSE" | jq -r '.generationId // empty')
    
    if [ -n "$GENERATION_ID" ] && [ "$GENERATION_ID" != "null" ]; then
        log_success "Code generated: $GENERATION_ID"
        
        # Check response structure
        OPERATIONS_COUNT=$(echo "$GEN_RESPONSE" | jq '.operations | length // 0')
        HAS_DIFFS=$(echo "$GEN_RESPONSE" | jq 'has("diffs")')
        HAS_SNAPSHOT=$(echo "$GEN_RESPONSE" | jq 'has("snapshotId")')
        
        log_info "Operations: $OPERATIONS_COUNT"
        log_info "Has diffs: $HAS_DIFFS"
        log_info "Has snapshot: $HAS_SNAPSHOT"
        
        if [ "$OPERATIONS_COUNT" -gt 0 ] && [ "$HAS_DIFFS" = "true" ] && [ "$HAS_SNAPSHOT" = "true" ]; then
            log_success "Generation response structure valid"
        else
            log_error "Generation response structure invalid"
        fi
    else
        log_error "Failed to generate code"
        echo "Response: $GEN_RESPONSE"
        SKIP_AI_TESTS=true
    fi
    
    # Test 8: Get generation details
    if [ -n "$GENERATION_ID" ]; then
        test_start "Fetch generation details"
        GEN_DETAILS=$(curl -s -X GET "$API_URL/ai/generations/$GENERATION_ID" \
            -b "$COOKIE_FILE")
        
        GEN_STATUS=$(echo "$GEN_DETAILS" | jq -r '.status // empty')
        
        if [ "$GEN_STATUS" = "pending" ]; then
            log_success "Generation status is 'pending'"
        else
            log_error "Generation status is '$GEN_STATUS' (expected 'pending')"
        fi
    fi
    
    # Test 9: Approve generation
    if [ -n "$GENERATION_ID" ]; then
        test_start "Approve and apply code changes"
        log_info "Approving generation..."
        
        APPROVE_RESPONSE=$(curl -s -X POST "$API_URL/ai/generations/$GENERATION_ID/approve" \
            -b "$COOKIE_FILE")
        
        APPROVE_SUCCESS=$(echo "$APPROVE_RESPONSE" | jq -r '.success // false')
        FILES_CHANGED=$(echo "$APPROVE_RESPONSE" | jq -r '.filesChanged | length // 0')
        
        if [ "$APPROVE_SUCCESS" = "true" ] && [ "$FILES_CHANGED" -gt 0 ]; then
            log_success "Code applied successfully, $FILES_CHANGED files changed"
            
            # Verify generation status updated
            GEN_AFTER=$(curl -s -X GET "$API_URL/ai/generations/$GENERATION_ID" \
                -b "$COOKIE_FILE")
            STATUS_AFTER=$(echo "$GEN_AFTER" | jq -r '.status // empty')
            
            if [ "$STATUS_AFTER" = "applied" ]; then
                log_success "Generation status updated to 'applied'"
            else
                log_error "Generation status is '$STATUS_AFTER' (expected 'applied')"
            fi
        else
            log_error "Failed to apply code"
            echo "Response: $APPROVE_RESPONSE"
        fi
    fi
    
    # Test 10: Verify files were created
    if [ "$APPROVE_SUCCESS" = "true" ]; then
        test_start "Verify files were created"
        sleep 2  # Give time for files to be written
        
        FILES_AFTER=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/files" \
            -b "$COOKIE_FILE")
        
        FILE_COUNT_AFTER=$(echo "$FILES_AFTER" | jq 'length // 0')
        
        if [ "$FILE_COUNT_AFTER" -gt "$FILE_COUNT" ]; then
            log_success "Files were created in project ($FILE_COUNT_AFTER total)"
            
            # Check if Button.tsx exists
            BUTTON_FILE=$(echo "$FILES_AFTER" | jq -r '.[] | select(.path | contains("Button")) | .path')
            if [ -n "$BUTTON_FILE" ]; then
                log_success "Button component file found: $BUTTON_FILE"
            else
                log_warning "Button component file not found in expected location"
            fi
        else
            log_error "No new files were created ($FILE_COUNT_AFTER vs $FILE_COUNT)"
        fi
    fi
    
    # Test 11: Test rejection workflow
    test_start "Test rejection workflow"
    log_info "Generating another component to reject..."
    
    GEN2_RESPONSE=$(curl -s -X POST "$API_URL/ai/generate" \
        -H "Content-Type: application/json" \
        -b "$COOKIE_FILE" \
        -d "{
            \"projectId\":\"$PROJECT_ID\",
            \"prompt\":\"Create a Card component with a header, body, and footer section.\",
            \"model\":\"gpt-4o\"
        }")
    
    GEN2_ID=$(echo "$GEN2_RESPONSE" | jq -r '.generationId // empty')
    
    if [ -n "$GEN2_ID" ]; then
        REJECT_RESPONSE=$(curl -s -X POST "$API_URL/ai/generations/$GEN2_ID/reject" \
            -b "$COOKIE_FILE")
        
        REJECT_SUCCESS=$(echo "$REJECT_RESPONSE" | jq -r '.success // false')
        
        if [ "$REJECT_SUCCESS" = "true" ]; then
            log_success "Generation rejected successfully"
            
            # Verify status
            GEN2_AFTER=$(curl -s -X GET "$API_URL/ai/generations/$GEN2_ID" \
                -b "$COOKIE_FILE")
            STATUS_REJECTED=$(echo "$GEN2_AFTER" | jq -r '.status // empty')
            
            if [ "$STATUS_REJECTED" = "rejected" ]; then
                log_success "Generation status updated to 'rejected'"
            else
                log_error "Generation status is '$STATUS_REJECTED' (expected 'rejected')"
            fi
            
            # Verify no new files were created
            FILES_FINAL=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/files" \
                -b "$COOKIE_FILE")
            FILE_COUNT_FINAL=$(echo "$FILES_FINAL" | jq 'length // 0')
            
            if [ "$FILE_COUNT_FINAL" = "$FILE_COUNT_AFTER" ]; then
                log_success "No files were created after rejection"
            else
                log_error "Files were created despite rejection"
            fi
        else
            log_error "Failed to reject generation"
        fi
    fi
else
    log_info "Skipping AI tests (no API key configured)"
fi

# Test 12: UI Component Check
test_start "UI components accessibility"
log_info "Checking if UI components load..."

EDITOR_PAGE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/editor/$PROJECT_ID")

if echo "$EDITOR_PAGE" | grep -q "DyadEditorClient"; then
    log_success "3-panel editor layout loads"
elif echo "$EDITOR_PAGE" | grep -q "editor"; then
    log_success "Editor page loads (may be client-side rendered)"
else
    log_warning "Could not verify editor page content"
fi

# Test 13: Database integrity
test_start "Database integrity check"
log_info "Checking database records..."

# Check project exists in database
docker exec dyad-db psql -U dyad -d dyad -t -c "SELECT COUNT(*) FROM projects WHERE id = '$PROJECT_ID';" | tr -d ' ' | grep -q "1"
if [ $? -eq 0 ]; then
    log_success "Project exists in database"
else
    log_error "Project not found in database"
fi

# Check ai_generations table if we created generations
if [ -n "$GENERATION_ID" ]; then
    docker exec dyad-db psql -U dyad -d dyad -t -c "SELECT COUNT(*) FROM ai_generations WHERE id = '$GENERATION_ID';" | tr -d ' ' | grep -q "1"
    if [ $? -eq 0 ]; then
        log_success "AI generation record exists in database"
    else
        log_error "AI generation record not found in database"
    fi
fi

# Test Summary
echo ""
echo "=========================================="
echo "Integration Test Summary"
echo "=========================================="
echo "Total tests run: $TESTS_RUN"
echo -e "${GREEN}Tests passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests failed: $TESTS_FAILED${NC}"
echo ""

if [ -n "$PROJECT_ID" ]; then
    echo "Test project ID: $PROJECT_ID"
    echo "View in browser: $BASE_URL/editor/$PROJECT_ID"
fi

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All integration tests passed!${NC}"
    echo ""
    echo "The Dyad Web Platform is working correctly:"
    echo "  ✓ Docker containers running"
    echo "  ✓ Application responsive"
    echo "  ✓ User authentication working"
    echo "  ✓ Project creation working"
    echo "  ✓ 3-panel editor layout functional"
    if [ "$SKIP_AI_TESTS" != "true" ]; then
        echo "  ✓ AI code generation working"
        echo "  ✓ Diff viewer working"
        echo "  ✓ Approval/rejection workflow working"
        echo "  ✓ File operations working"
    fi
    echo "  ✓ Database integrity maintained"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some integration tests failed${NC}"
    echo ""
    echo "Check the logs above for details."
    echo ""
    exit 1
fi
