# Phase 1 Testing - Quick Reference Card

**Quick access to all testing commands and checks**

---

## 🚀 Quick Start

```bash
# 1. Verify all containers running
docker ps | grep dyad

# 2. Check app health
curl http://localhost:3000

# 3. Open app in browser
open http://localhost:3000
```

---

## 📊 System Status Checks

### Container Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep dyad
```

### App Logs (Last 50 lines)
```bash
docker logs dyad-collaborative-app-1 --tail 50
```

### Database Connection
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT version();"
```

---

## 🗄️ Database Quick Checks

### View Invitations Table Schema
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "\d project_invitations"
```

### Count All Invitations
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT status, COUNT(*) FROM project_invitations GROUP BY status;"
```

### View Recent Invitations
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative << 'EOF'
SELECT 
  email, 
  role, 
  status, 
  expires_at,
  created_at
FROM project_invitations
ORDER BY created_at DESC
LIMIT 10;
EOF
```

### View Accepted Invitations
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative << 'EOF'
SELECT 
  pi.email, 
  pi.role, 
  pi.accepted_at,
  u.email as inviter_email
FROM project_invitations pi
LEFT JOIN users u ON pi.invited_by = u.id
WHERE pi.status = 'accepted'
ORDER BY pi.accepted_at DESC;
EOF
```

### Clear All Test Invitations (Caution!)
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "DELETE FROM project_invitations WHERE email LIKE '%@example.com';"
```

---

## 🔌 API Endpoint Tests

### Test Authentication Check
```bash
curl http://localhost:3000/api/projects/test-id/invitations
# Expected: {"error":"Unauthorized","code":"UNAUTHORIZED"}
```

### Test Invalid Token
```bash
curl http://localhost:3000/api/invitations/invalid-token
# Expected: {"error":"Invitation not found","code":"INVITATION_NOT_FOUND"}
```

### Test Invitation Details (Replace with real token)
```bash
TOKEN="your-64-char-token-here"
curl http://localhost:3000/api/invitations/$TOKEN
```

### Create Invitation via API (Requires Auth Token)
```bash
AUTH_TOKEN="your-auth-token"
PROJECT_ID="your-project-id"

curl -X POST http://localhost:3000/api/projects/$PROJECT_ID/invitations \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "editor",
    "expiresInHours": 168
  }'
```

---

## 📧 Email Logs

### View All Email Notifications
```bash
docker logs dyad-collaborative-app-1 2>&1 | grep -A 30 "========== EMAIL NOTIFICATION =========="
```

### Count Email Notifications Sent
```bash
docker logs dyad-collaborative-app-1 2>&1 | grep -c "EMAIL NOTIFICATION"
```

### View Latest Email
```bash
docker logs dyad-collaborative-app-1 2>&1 | grep -A 30 "========== EMAIL NOTIFICATION ==========" | tail -31
```

---

## 🧹 Cleanup Commands

### Restart All Containers
```bash
cd /Users/sanjoy.ghoshapexon.com/Library/CloudStorage/OneDrive-Apexon/demoworkspace/dyad-collaborative
docker compose down
docker compose up -d
```

### Rebuild Containers (After Code Changes)
```bash
docker compose down
docker compose up -d --build
```

### Clear Docker Logs
```bash
docker compose down
docker compose up -d
# Logs are cleared on restart
```

### Reset Test Data
```bash
# Delete all test invitations
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative << 'EOF'
DELETE FROM project_invitations 
WHERE email IN (
  'colleague@example.com',
  'user-a@example.com',
  'user-b@example.com',
  'viewer@example.com',
  'reject-test@example.com',
  'test@example.com'
);
EOF
```

---

## 🔍 Debugging Commands

### Check TypeScript Errors
```bash
cd /Users/sanjoy.ghoshapexon.com/Library/CloudStorage/OneDrive-Apexon/demoworkspace/dyad-collaborative
npx tsc --noEmit
```

### Check File Exists
```bash
ls -la src/components/collaboration/CollaboratorsList.tsx
ls -la src/lib/collaboration/invitation-manager.ts
ls -la src/lib/email/email-service.ts
```

### View Component Source
```bash
cat src/components/collaboration/InviteCollaboratorModal.tsx | head -50
```

### Search for Component Usage
```bash
grep -r "CollaboratorsList" src/app --include="*.tsx"
```

### Find Project Detail Page
```bash
find src/app -name "page.tsx" | grep -E "projects/\[|project/\["
```

---

## 📱 Browser Testing URLs

### Main App
```
http://localhost:3000
```

### Login Page
```
http://localhost:3000/login
```

### Example Invitation URL (Replace token)
```
http://localhost:3000/invitations/[64-char-token]
```

### Project Page (Replace ID)
```
http://localhost:3000/projects/[project-id]
```

---

## 🎯 Quick Test Scenarios

### Scenario 1: Send & Accept Invitation (2 minutes)
```bash
# 1. Login at http://localhost:3000
# 2. Open any project you own
# 3. Click "Invite Collaborator"
# 4. Enter: test@example.com, role: Editor
# 5. Copy invitation URL
# 6. Open URL in incognito window
# 7. Click "Accept Invitation"
# 8. Login if needed
# 9. Verify redirect to project
```

### Scenario 2: Check Email Was Sent (30 seconds)
```bash
docker logs dyad-collaborative-app-1 2>&1 | grep -A 20 "EMAIL NOTIFICATION" | tail -21
```

### Scenario 3: Verify Database Entry (30 seconds)
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT email, role, status, created_at FROM project_invitations ORDER BY created_at DESC LIMIT 5;"
```

---

## 🚨 Common Error Solutions

### Error: "Cannot connect to Docker daemon"
```bash
# Start Docker Desktop
open -a Docker

# Wait for Docker to start, then retry
docker ps
```

### Error: Port 3000 already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process (replace PID)
kill -9 [PID]

# Or stop containers and restart
docker compose down
docker compose up -d
```

### Error: Database connection refused
```bash
# Check if database container is running
docker ps | grep db

# Restart database
docker restart dyad-collaborative-db-1

# Wait 10 seconds and test
sleep 10
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT 1;"
```

### Error: Module not found
```bash
# Rebuild containers with no cache
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 📊 Health Check Script

Save this as `test-health.sh` and run with `bash test-health.sh`:

```bash
#!/bin/bash

echo "=== DYAD COLLABORATIVE HEALTH CHECK ==="
echo ""

echo "1. Checking Docker containers..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep dyad
echo ""

echo "2. Checking app responsiveness..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$STATUS" = "200" ]; then
    echo "✅ App responding (HTTP $STATUS)"
else
    echo "❌ App not responding (HTTP $STATUS)"
fi
echo ""

echo "3. Checking database connection..."
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database connected"
else
    echo "❌ Database connection failed"
fi
echo ""

echo "4. Checking project_invitations table..."
COUNT=$(docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -t -c "SELECT COUNT(*) FROM project_invitations;" 2>/dev/null | tr -d ' ')
echo "   Found $COUNT invitations in database"
echo ""

echo "5. Checking recent app logs..."
ERRORS=$(docker logs dyad-collaborative-app-1 --tail 100 2>&1 | grep -i "error" | wc -l | tr -d ' ')
if [ "$ERRORS" -gt 0 ]; then
    echo "⚠️  Found $ERRORS error lines in logs"
else
    echo "✅ No errors in recent logs"
fi
echo ""

echo "=== HEALTH CHECK COMPLETE ==="
```

---

## 🎓 Testing Best Practices

### Before Each Test Session
1. Check all containers are running: `docker ps`
2. Clear previous test data: See "Reset Test Data" above
3. Check app logs are clean: `docker logs dyad-collaborative-app-1 --tail 20`

### During Testing
1. Keep Docker logs open in terminal: `docker logs -f dyad-collaborative-app-1`
2. Use browser dev tools console (F12)
3. Take screenshots of any issues
4. Note exact error messages

### After Each Test
1. Document results in test template
2. Save any error logs
3. Note any unexpected behavior
4. Update test status in checklist

---

## 📞 Need Help?

### View Full Documentation
```bash
# Open testing guide
open docs/PHASE_1_MANUAL_TESTING_GUIDE.md

# Open implementation summary
open docs/PHASE_1_COMPLETE_SUMMARY.md
```

### Check Implementation Details
```bash
# View invitation manager code
cat src/lib/collaboration/invitation-manager.ts | less

# View email service code
cat src/lib/email/email-service.ts | less

# View UI component code
cat src/components/collaboration/CollaboratorsList.tsx | less
```

---

**Last Updated:** November 6, 2025  
**Phase:** 1 - Invitation System (78% Complete)  
**Next:** Manual Testing → Integration Tests → Permission System
