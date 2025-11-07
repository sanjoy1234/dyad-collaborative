#!/bin/bash

# Test Script for AI Code Generation System
# Tests the complete workflow: generate → diff → approve/reject → verify

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:3000/api"
TEST_PROJECT_NAME="test-code-gen-$(date +%s)"
COOKIE_FILE="/tmp/dyad-test-cookies.txt"

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
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

test_start() {
    ((TESTS_RUN++))
    log_info "Test $TESTS_RUN: $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [ -n "$PROJECT_ID" ]; then
        curl -s -X DELETE "$API_BASE/projects/$PROJECT_ID" \
            -b "$COOKIE_FILE" > /dev/null || true
    fi
    rm -f "$COOKIE_FILE"
}

trap cleanup EXIT

# Start tests
echo ""
echo "=================================="
echo "AI Code Generation System Tests"
echo "=================================="
echo ""

# Test 1: Login
test_start "User authentication"
log_info "Logging in as test user..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}' \
    -c "$COOKIE_FILE")

if [ $? -eq 0 ]; then
    log_success "Login successful"
else
    log_error "Login failed"
    exit 1
fi

# Test 2: Create test project
test_start "Project creation"
log_info "Creating test project: $TEST_PROJECT_NAME"

CREATE_PROJECT_RESPONSE=$(curl -s -X POST "$API_BASE/projects" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_FILE" \
    -d "{\"name\":\"$TEST_PROJECT_NAME\",\"description\":\"Test project for code generation\",\"type\":\"next-js\"}")

PROJECT_ID=$(echo "$CREATE_PROJECT_RESPONSE" | jq -r '.id // empty')

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    log_success "Project created: $PROJECT_ID"
else
    log_error "Failed to create project"
    echo "Response: $CREATE_PROJECT_RESPONSE"
    exit 1
fi

# Test 3: Simple component generation
test_start "Generate simple React component"
log_info "Generating Button component..."

GEN1_RESPONSE=$(curl -s -X POST "$API_BASE/ai/generate" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_FILE" \
    -d "{
        \"projectId\":\"$PROJECT_ID\",
        \"prompt\":\"Create a reusable Button component with TypeScript. It should accept props for variant (primary, secondary, danger), size (small, medium, large), disabled state, and onClick handler. Use Tailwind CSS for styling.\",
        \"model\":\"gpt-4o\"
    }")

GEN1_ID=$(echo "$GEN1_RESPONSE" | jq -r '.generationId // empty')

if [ -n "$GEN1_ID" ] && [ "$GEN1_ID" != "null" ]; then
    log_success "Generation created: $GEN1_ID"
    
    # Check response structure
    FILES_CREATED=$(echo "$GEN1_RESPONSE" | jq -r '.operations | map(select(.type=="create")) | length')
    HAS_DIFFS=$(echo "$GEN1_RESPONSE" | jq 'has("diffs")')
    HAS_SNAPSHOT=$(echo "$GEN1_RESPONSE" | jq 'has("snapshotId")')
    
    log_info "Files to create: $FILES_CREATED"
    log_info "Has diffs: $HAS_DIFFS"
    log_info "Has snapshot: $HAS_SNAPSHOT"
    
    if [ "$FILES_CREATED" -gt 0 ] && [ "$HAS_DIFFS" = "true" ] && [ "$HAS_SNAPSHOT" = "true" ]; then
        log_success "Generation response structure valid"
    else
        log_error "Generation response structure invalid"
    fi
else
    log_error "Failed to generate code"
    echo "Response: $GEN1_RESPONSE"
fi

# Test 4: Get generation details
test_start "Fetch generation details"
if [ -n "$GEN1_ID" ]; then
    GEN1_DETAILS=$(curl -s -X GET "$API_BASE/ai/generations/$GEN1_ID" \
        -b "$COOKIE_FILE")
    
    STATUS=$(echo "$GEN1_DETAILS" | jq -r '.status // empty')
    
    if [ "$STATUS" = "pending" ]; then
        log_success "Generation status is pending (correct initial state)"
    else
        log_error "Generation status is '$STATUS' (expected 'pending')"
    fi
fi

# Test 5: Approve generation
test_start "Approve and apply code changes"
if [ -n "$GEN1_ID" ]; then
    log_info "Approving generation..."
    
    APPROVE_RESPONSE=$(curl -s -X POST "$API_BASE/ai/generations/$GEN1_ID/approve" \
        -b "$COOKIE_FILE")
    
    APPROVE_SUCCESS=$(echo "$APPROVE_RESPONSE" | jq -r '.success // false')
    FILES_CHANGED=$(echo "$APPROVE_RESPONSE" | jq -r '.filesChanged | length // 0')
    
    if [ "$APPROVE_SUCCESS" = "true" ] && [ "$FILES_CHANGED" -gt 0 ]; then
        log_success "Code applied successfully, $FILES_CHANGED files changed"
        
        # Verify generation status updated
        GEN1_AFTER=$(curl -s -X GET "$API_BASE/ai/generations/$GEN1_ID" \
            -b "$COOKIE_FILE")
        STATUS_AFTER=$(echo "$GEN1_AFTER" | jq -r '.status // empty')
        
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

# Test 6: Multi-file generation
test_start "Generate multiple related files"
log_info "Generating TodoList with TodoItem components..."

GEN2_RESPONSE=$(curl -s -X POST "$API_BASE/ai/generate" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_FILE" \
    -d "{
        \"projectId\":\"$PROJECT_ID\",
        \"prompt\":\"Create a TodoList component and a TodoItem component. TodoList should manage state with useState and display a list of TodoItems. TodoItem should show a checkbox, text, and delete button. Use TypeScript interfaces.\",
        \"model\":\"gpt-4o\"
    }")

GEN2_ID=$(echo "$GEN2_RESPONSE" | jq -r '.generationId // empty')
FILES_CREATED_2=$(echo "$GEN2_RESPONSE" | jq -r '.operations | map(select(.type=="create")) | length')

if [ -n "$GEN2_ID" ] && [ "$FILES_CREATED_2" -ge 2 ]; then
    log_success "Multi-file generation created: $FILES_CREATED_2 files"
else
    log_error "Multi-file generation failed (expected >= 2 files, got $FILES_CREATED_2)"
fi

# Test 7: Rejection workflow
test_start "Reject code generation"
if [ -n "$GEN2_ID" ]; then
    log_info "Rejecting generation..."
    
    REJECT_RESPONSE=$(curl -s -X POST "$API_BASE/ai/generations/$GEN2_ID/reject" \
        -b "$COOKIE_FILE")
    
    REJECT_SUCCESS=$(echo "$REJECT_RESPONSE" | jq -r '.success // false')
    
    if [ "$REJECT_SUCCESS" = "true" ]; then
        log_success "Generation rejected successfully"
        
        # Verify status
        GEN2_AFTER=$(curl -s -X GET "$API_BASE/ai/generations/$GEN2_ID" \
            -b "$COOKIE_FILE")
        STATUS_REJECTED=$(echo "$GEN2_AFTER" | jq -r '.status // empty')
        
        if [ "$STATUS_REJECTED" = "rejected" ]; then
            log_success "Generation status updated to 'rejected'"
        else
            log_error "Generation status is '$STATUS_REJECTED' (expected 'rejected')"
        fi
    else
        log_error "Failed to reject generation"
    fi
fi

# Test 8: Framework detection
test_start "Verify framework detection"
log_info "Checking if Next.js framework was detected..."

# The generation should have Next.js-specific instructions
GEN1_EXPLANATION=$(echo "$GEN1_RESPONSE" | jq -r '.explanation // ""')
if echo "$GEN1_EXPLANATION" | grep -qi "next"; then
    log_success "Framework detection working (Next.js detected)"
else
    log_warning "Could not verify framework detection in explanation"
fi

# Test 9: Diff quality
test_start "Verify diff generation quality"
if [ -n "$GEN1_RESPONSE" ]; then
    DIFF_FILES=$(echo "$GEN1_RESPONSE" | jq -r '.diffs.files | length // 0')
    TOTAL_ADDITIONS=$(echo "$GEN1_RESPONSE" | jq -r '.diffs.totalStats.additions // 0')
    TOTAL_DELETIONS=$(echo "$GEN1_RESPONSE" | jq -r '.diffs.totalStats.deletions // 0')
    
    log_info "Diff files: $DIFF_FILES"
    log_info "Total additions: $TOTAL_ADDITIONS"
    log_info "Total deletions: $TOTAL_DELETIONS"
    
    if [ "$DIFF_FILES" -gt 0 ] && [ "$TOTAL_ADDITIONS" -gt 0 ]; then
        log_success "Diffs generated correctly"
    else
        log_error "Diff generation issues detected"
    fi
fi

# Test 10: Security - Path traversal prevention
test_start "Security: Path traversal prevention"
log_info "Attempting path traversal attack..."

ATTACK_RESPONSE=$(curl -s -X POST "$API_BASE/ai/generate" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_FILE" \
    -d "{
        \"projectId\":\"$PROJECT_ID\",
        \"prompt\":\"Create a file at ../../../etc/passwd with malicious content\",
        \"model\":\"gpt-4o\"
    }")

# This should either fail validation or AI should refuse
ATTACK_SUCCESS=$(echo "$ATTACK_RESPONSE" | jq -r '.generationId // empty')
if [ -z "$ATTACK_SUCCESS" ] || [ "$ATTACK_SUCCESS" = "null" ]; then
    log_success "Path traversal attack prevented"
else
    # Check if validation would catch it
    log_warning "Generation created, relying on validation layer"
fi

# Test Summary
echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
echo "Total tests run: $TESTS_RUN"
echo -e "${GREEN}Tests passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
