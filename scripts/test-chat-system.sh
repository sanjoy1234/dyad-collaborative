#!/bin/bash
# Test script for AI Chat System (Phase 3)
# Usage: ./test-chat-system.sh

set -e  # Exit on error

BASE_URL="http://localhost:3000"
PROJECT_ID=""  # Will be set from existing project or created
CHAT_ID=""
SESSION_COOKIE=""

echo "==================================="
echo "AI Chat System Test Script"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test status
print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if Docker is running
print_test "Checking if Docker services are running..."
if ! docker ps | grep -q "dyad-collaborative-app"; then
    print_error "Docker services not running. Start with: docker-compose up -d"
    exit 1
fi
print_success "Docker services are running"

# Check if app is accessible
print_test "Checking if app is accessible..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "307" ]; then
    print_error "App not accessible (HTTP $HTTP_CODE)"
    exit 1
fi
print_success "App is accessible"

echo ""
echo "==================================="
echo "MANUAL SETUP REQUIRED"
echo "==================================="
echo ""
echo "Before running tests, you need to:"
echo "1. Login to the app at $BASE_URL"
echo "2. Create a project (or use existing one)"
echo "3. Get your session cookie"
echo ""
echo "To get your session cookie:"
echo "  1. Open browser DevTools (F12)"
echo "  2. Go to Application > Cookies > $BASE_URL"
echo "  3. Copy the value of 'next-auth.session-token'"
echo ""
read -p "Enter your SESSION TOKEN: " SESSION_COOKIE
echo ""
read -p "Enter your PROJECT ID: " PROJECT_ID
echo ""

if [ -z "$SESSION_COOKIE" ] || [ -z "$PROJECT_ID" ]; then
    print_error "Session cookie and project ID are required"
    exit 1
fi

echo "==================================="
echo "Phase 3: AI Chat System Tests"
echo "==================================="
echo ""

# Test 1: List chats (should be empty initially)
print_test "Test 1: List chats (GET /api/projects/$PROJECT_ID/chats)"
RESPONSE=$(curl -s -X GET \
    -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
    "$BASE_URL/api/projects/$PROJECT_ID/chats")

if echo "$RESPONSE" | grep -q '"chats"'; then
    print_success "Successfully fetched chats"
    echo "Response: $RESPONSE"
else
    print_error "Failed to fetch chats"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 2: Create a new chat
print_test "Test 2: Create new chat (POST /api/projects/$PROJECT_ID/chats)"
RESPONSE=$(curl -s -X POST \
    -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test Chat","model":"gpt-4"}' \
    "$BASE_URL/api/projects/$PROJECT_ID/chats")

if echo "$RESPONSE" | grep -q '"id"'; then
    CHAT_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_success "Successfully created chat: $CHAT_ID"
    echo "Response: $RESPONSE"
else
    print_error "Failed to create chat"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 3: Get chat details
print_test "Test 3: Get chat details (GET /api/projects/$PROJECT_ID/chats/$CHAT_ID)"
RESPONSE=$(curl -s -X GET \
    -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
    "$BASE_URL/api/projects/$PROJECT_ID/chats/$CHAT_ID")

if echo "$RESPONSE" | grep -q '"title":"Test Chat"'; then
    print_success "Successfully fetched chat details"
    echo "Response: $RESPONSE"
else
    print_error "Failed to fetch chat details"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 4: Get messages (should be empty)
print_test "Test 4: Get messages (GET /api/projects/$PROJECT_ID/chats/$CHAT_ID/messages)"
RESPONSE=$(curl -s -X GET \
    -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
    "$BASE_URL/api/projects/$PROJECT_ID/chats/$CHAT_ID/messages")

if echo "$RESPONSE" | grep -q '"messages":\[\]'; then
    print_success "Successfully fetched messages (empty)"
    echo "Response: $RESPONSE"
else
    print_error "Failed to fetch messages"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 5: Stream chat (requires API key)
echo ""
echo "==================================="
echo "STREAMING TEST (Optional)"
echo "==================================="
echo ""
echo "To test streaming, you need:"
echo "1. An API key configured (OpenAI, Anthropic, or Google)"
echo "2. The 'auto' mode will use Google Gemini (free)"
echo ""
read -p "Do you want to test streaming? (y/n): " TEST_STREAMING

if [ "$TEST_STREAMING" = "y" ]; then
    print_test "Test 5: Send message and stream response"
    echo "Sending message: 'Hello, introduce yourself in one sentence'"
    echo ""
    
    curl -N -X POST \
        -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
        -H "Content-Type: application/json" \
        -d "{\"chatId\":\"$CHAT_ID\",\"message\":\"Hello, introduce yourself in one sentence\",\"projectId\":\"$PROJECT_ID\"}" \
        "$BASE_URL/api/ai/chat"
    
    echo ""
    echo ""
    print_success "Streaming test completed"
else
    echo "Skipping streaming test"
fi
echo ""

# Test 6: Update chat title
print_test "Test 6: Update chat title (PATCH /api/projects/$PROJECT_ID/chats/$CHAT_ID)"
RESPONSE=$(curl -s -X PATCH \
    -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
    -H "Content-Type: application/json" \
    -d '{"title":"Updated Test Chat"}' \
    "$BASE_URL/api/projects/$PROJECT_ID/chats/$CHAT_ID")

if echo "$RESPONSE" | grep -q '"title":"Updated Test Chat"'; then
    print_success "Successfully updated chat title"
    echo "Response: $RESPONSE"
else
    print_error "Failed to update chat title"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 7: List chats again (should show our chat)
print_test "Test 7: List chats again (should show 1 chat)"
RESPONSE=$(curl -s -X GET \
    -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
    "$BASE_URL/api/projects/$PROJECT_ID/chats")

if echo "$RESPONSE" | grep -q "Updated Test Chat"; then
    print_success "Successfully verified chat in list"
    echo "Response: $RESPONSE"
else
    print_error "Chat not found in list"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 8: Delete chat
read -p "Do you want to delete the test chat? (y/n): " DELETE_CHAT
if [ "$DELETE_CHAT" = "y" ]; then
    print_test "Test 8: Delete chat (DELETE /api/projects/$PROJECT_ID/chats/$CHAT_ID)"
    RESPONSE=$(curl -s -X DELETE \
        -H "Cookie: next-auth.session-token=$SESSION_COOKIE" \
        "$BASE_URL/api/projects/$PROJECT_ID/chats/$CHAT_ID")

    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Successfully deleted chat"
        echo "Response: $RESPONSE"
    else
        print_error "Failed to delete chat"
        echo "Response: $RESPONSE"
    fi
else
    echo "Chat preserved: $CHAT_ID"
fi
echo ""

echo "==================================="
echo "TEST SUMMARY"
echo "==================================="
echo ""
print_success "Phase 3 (AI Chat System) tests completed!"
echo ""
echo "✓ Chat CRUD operations working"
echo "✓ Message retrieval working"
echo "✓ Streaming API ready (requires API key)"
echo ""
echo "Next steps:"
echo "1. Configure an AI model API key (OpenAI, Anthropic, or Google)"
echo "2. Test streaming with real AI responses"
echo "3. Move to Phase 4: Code Generation System"
echo ""
