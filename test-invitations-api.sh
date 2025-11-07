#!/bin/bash

# Test script for Phase 1 MVP - Invitation System
# Tests: Create, List, Get, Accept, Reject, and Revoke invitations

echo "================================"
echo "Phase 1 MVP - Invitation System Test"
echo "================================"
echo ""

# Configuration
API_URL="http://localhost:3000/api"
PROJECT_ID="test-project-id"  # Replace with actual project ID
AUTH_TOKEN="test-token"  # Replace with actual auth token

echo "Step 1: Testing Authentication Check"
echo "-----------------------------------"
echo "GET /api/projects/$PROJECT_ID/invitations (without auth)"
curl -s -X GET "$API_URL/projects/$PROJECT_ID/invitations" | jq '.'
echo ""
echo ""

echo "Step 2: Create Invitation"
echo "-------------------------"
echo "POST /api/projects/$PROJECT_ID/invitations"
echo "Payload: { email: 'test@example.com', role: 'editor' }"

# Note: This will fail without valid authentication
# Replace with actual implementation when auth is set up
response=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/invitations" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "editor",
    "expiresInHours": 168
  }')

echo "$response" | jq '.'
INVITATION_ID=$(echo "$response" | jq -r '.invitation.id // empty')
TOKEN=$(echo "$response" | jq -r '.invitation.invitationUrl // empty' | sed 's|.*/||')
echo ""
echo "Created invitation ID: $INVITATION_ID"
echo "Invitation token: $TOKEN"
echo ""
echo ""

echo "Step 3: List Project Invitations"
echo "--------------------------------"
echo "GET /api/projects/$PROJECT_ID/invitations"
curl -s -X GET "$API_URL/projects/$PROJECT_ID/invitations" | jq '.'
echo ""
echo ""

echo "Step 4: Get Invitation Details"
echo "------------------------------"
if [ -n "$TOKEN" ]; then
  echo "GET /api/invitations/$TOKEN"
  curl -s -X GET "$API_URL/invitations/$TOKEN" | jq '.'
else
  echo "Skipping - No token available"
fi
echo ""
echo ""

echo "Step 5: Accept Invitation"
echo "-------------------------"
if [ -n "$TOKEN" ]; then
  echo "POST /api/invitations/$TOKEN/accept"
  curl -s -X POST "$API_URL/invitations/$TOKEN/accept" | jq '.'
else
  echo "Skipping - No token available"
fi
echo ""
echo ""

echo "Step 6: Reject Invitation"
echo "-------------------------"
echo "POST /api/invitations/[token]/reject"
echo "(Using a test token)"
curl -s -X POST "$API_URL/invitations/test-token/reject" | jq '.'
echo ""
echo ""

echo "Step 7: Revoke Invitation"
echo "-------------------------"
if [ -n "$INVITATION_ID" ]; then
  echo "DELETE /api/projects/$PROJECT_ID/invitations/$INVITATION_ID"
  curl -s -X DELETE "$API_URL/projects/$PROJECT_ID/invitations/$INVITATION_ID" | jq '.'
else
  echo "Skipping - No invitation ID available"
fi
echo ""
echo ""

echo "================================"
echo "Test Complete"
echo "================================"
echo ""
echo "Expected Results:"
echo "- Step 1: 401 Unauthorized (no auth token)"
echo "- Step 2: 401 Unauthorized OR 201 Created (if you add auth token)"
echo "- Step 3: 401 Unauthorized OR invitation list"
echo "- Step 4: 404 Not Found OR invitation details"
echo "- Step 5: 401 Unauthorized (not logged in)"
echo "- Step 6: 404 Not Found (invalid token)"
echo "- Step 7: 401 Unauthorized OR 200 Success"
echo ""
echo "To run with authentication, update AUTH_TOKEN and PROJECT_ID variables"
echo "and add: -H \"Authorization: Bearer \$AUTH_TOKEN\" to curl commands"
