# 🚀 Localhost Testing Steps - Quick Start Guide

**Application Status:** ✅ **RUNNING and READY**  
**URL:** http://localhost:3000  
**Health Check:** 16/16 Tests Passing (100%)  

---

## ✅ Step 1: Verify Application is Running

The application is **already running**! You can verify with:

```bash
# Check containers
docker ps | grep dyad

# Expected output:
# dyad-collaborative-app-1    Up X minutes    0.0.0.0:3000->3000/tcp
# dyad-collaborative-db-1     Up X minutes    0.0.0.0:5432->5432/tcp
# dyad-collaborative-redis-1  Up X minutes    0.0.0.0:6379->6379/tcp
```

**Status:** ✅ All 3 containers running

---

## 🌐 Step 2: Open Application in Browser

### Open the main application:
```
http://localhost:3000
```

**What you should see:**
- Login page OR
- Dashboard (if already logged in)

### Important URLs:

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Main application |
| http://localhost:3000/login | Login page |
| http://localhost:3000/register | Register new account |
| http://localhost:3000/projects | Projects list |
| http://localhost:3000/invitations/[token] | Accept invitation (need token) |

---

## 🧪 Step 3: Test Basic Functionality

### Test 3.1: Create Account / Login

1. **Open:** http://localhost:3000
2. **If not logged in:**
   - Click "Register" or go to http://localhost:3000/register
   - Create a new account with:
     - Email: your-email@example.com
     - Password: (your choice)
3. **Login** with your credentials

**Expected:** Successfully logged in and see dashboard/projects page

---

### Test 3.2: Create a Project

1. **Navigate to Projects page**
2. **Click "Create New Project" or "+"**
3. **Fill in:**
   - Project Name: "Test Collaboration Project"
   - Description: "Testing invitation system"
4. **Click "Create"**

**Expected:** New project created, redirected to project page

---

## 🎯 Step 4: Test Invitation System (NEW FEATURE)

### Find Your Project Page

Your project page URL will be something like:
```
http://localhost:3000/projects/[project-id]
```

**Note:** You need to add the CollaboratorsList component to your project page first. See "Step 5: Add UI Component" below if you don't see the invitation section.

---

### Test 4.1: Send an Invitation

1. **On your project page, look for:**
   - "Members" section
   - "Invite Collaborator" button

2. **Click "Invite Collaborator"**
   - Modal should open

3. **Fill the form:**
   - Email: `test-colleague@example.com` (or any email)
   - Role: Select "Editor" or "Viewer"
   - Click "Send Invitation"

4. **You should see:**
   - ✅ Success message
   - Invitation URL displayed
   - "Copy Link" button

5. **Copy the invitation URL** - it looks like:
   ```
   http://localhost:3000/invitations/a1b2c3d4e5f6...
   ```

**Expected Result:**
- ✅ Success toast notification
- ✅ Invitation URL copied to clipboard
- ✅ Can see invitation in "Pending Invitations" section

---

### Test 4.2: Check Email Notification (Console)

```bash
# Check Docker logs for email
docker logs dyad-collaborative-app-1 2>&1 | grep -A 20 "EMAIL NOTIFICATION"
```

**You should see:**
- Formatted email notification
- To: test-colleague@example.com
- Invitation URL
- Project name
- Inviter name

**Note:** In MVP mode, emails are logged to console. In production, they'll be sent via email service.

---

### Test 4.3: Accept Invitation

1. **Copy the invitation URL** from Step 4.1

2. **Open invitation URL in new browser tab/incognito:**
   ```
   http://localhost:3000/invitations/[your-token-here]
   ```

3. **You should see invitation details:**
   - Project name
   - Who invited you
   - Your email
   - Role (Editor or Viewer)
   - Expiration date
   - "Accept Invitation" button
   - "Decline" button

4. **To accept:**
   - Click "Accept Invitation"
   - If not logged in → You'll be redirected to login
   - Login with an account matching the invitation email
   - After login → Auto-redirected back to invitation
   - Invitation auto-accepted
   - Success message shown
   - Redirected to project page (after 2 seconds)

**Expected Result:**
- ✅ Invitation accepted
- ✅ You're now a collaborator on the project
- ✅ Can see project in your projects list

---

### Test 4.4: Verify Collaborator Added

1. **Go back to project page** (as owner)
2. **Refresh the page**
3. **Check "Members" section**

**You should see:**
- Your name (Owner badge)
- New collaborator's email (Editor or Viewer badge)
- "Remove" button next to collaborator (trash icon)

---

### Test 4.5: View as Collaborator

1. **Login with the collaborator account**
2. **Go to projects list**
3. **You should see the shared project**
4. **Open the project**

**Expected:**
- ✅ Can view project
- ✅ Can view files (if Editor role)
- ✅ Cannot see "Invite Collaborator" button (not owner)
- ✅ Cannot delete project (not owner)

---

## 🔧 Step 5: Add UI Component (If Not Visible)

If you don't see the "Invite Collaborator" button, you need to add the component:

### 5.1 Find Your Project Page File

```bash
# Search for project page
find src/app -name "page.tsx" | grep -E "projects/\[|project/\["
```

Common locations:
- `src/app/projects/[projectId]/page.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/app/dashboard/projects/[projectId]/page.tsx`

---

### 5.2 Add the Component

**Open your project page file and add:**

1. **Import at top:**
```typescript
import { CollaboratorsList } from '@/components/collaboration/CollaboratorsList';
```

2. **Add component in JSX** (after project header):
```typescript
<div className="mb-6">
  <CollaboratorsList
    projectId={projectId}
    projectName={project.name}
    currentUserId={session.user.id}
    isOwner={project.owner_id === session.user.id}
  />
</div>
```

3. **Save the file**
   - Hot reload should pick it up automatically
   - Or restart containers: `docker compose restart`

---

## 🧪 Step 6: Test Error Cases

### Test 6.1: Duplicate Invitation

1. Try to invite the **same email twice**
2. **Expected:** Error message "Invitation already pending for this email"

---

### Test 6.2: Invalid Email

1. Try to enter invalid email: `not-an-email`
2. **Expected:** Form validation error before submission

---

### Test 6.3: Wrong Email Accepts

1. **Send invitation to** `user-a@example.com`
2. **Login as different user** (user-b@example.com)
3. **Try to accept invitation**
4. **Expected:** Error "This invitation was sent to user-a@example.com"

---

### Test 6.4: Expired Invitation

To test expired invitations, you can manually expire one:

```bash
# Connect to database
docker exec -it dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative

# Expire an invitation
UPDATE project_invitations
SET expires_at = NOW() - INTERVAL '1 day',
    status = 'expired'
WHERE email = 'test-colleague@example.com'
AND status = 'pending';

# Exit
\q
```

Then try to accept the invitation → Should show "Invitation expired"

---

## 🎨 Step 7: Test Additional Features

### Test 7.1: Revoke Invitation

1. **As project owner, go to project page**
2. **Find "Pending Invitations" section**
3. **Click "Revoke" button** next to invitation
4. **Confirm revocation**
5. **Expected:** Invitation removed, URL becomes invalid

---

### Test 7.2: Reject Invitation

1. **Send new invitation**
2. **Open invitation URL** (without logging in)
3. **Click "Decline" button**
4. **Confirm rejection**
5. **Expected:** Success message, no login required

---

### Test 7.3: Remove Collaborator

1. **As project owner**
2. **Find "Members" section**
3. **Click "Remove" button** (trash icon) next to collaborator
4. **Confirm removal**
5. **Expected:** Collaborator removed, can no longer access project

---

## 📊 Step 8: Verify Database

### Check Invitations in Database

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

**You should see:**
- All invitations you created
- Their current status (pending/accepted/rejected/expired)
- Expiration dates
- Creation timestamps

---

## 🔍 Step 9: Monitor Application

### View Application Logs

```bash
# Real-time logs
docker logs -f dyad-collaborative-app-1

# Last 50 lines
docker logs dyad-collaborative-app-1 --tail 50

# Search for errors
docker logs dyad-collaborative-app-1 2>&1 | grep -i error
```

---

### Check Container Status

```bash
# All containers
docker ps

# Specific container
docker ps | grep dyad-collaborative-app-1
```

---

### Database Connection

```bash
# Connect to database
docker exec -it dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative

# Inside psql:
\dt                           # List tables
\d project_invitations        # Describe table
SELECT COUNT(*) FROM project_invitations;  # Count invitations
\q                            # Exit
```

---

## 🐛 Troubleshooting

### Application Not Loading

```bash
# Check if containers are running
docker ps | grep dyad

# If not running, start them
docker compose up -d

# Check logs for errors
docker logs dyad-collaborative-app-1 --tail 50
```

---

### Port Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process (replace PID)
kill -9 [PID]

# Restart containers
docker compose restart
```

---

### Database Connection Issues

```bash
# Restart database
docker restart dyad-collaborative-db-1

# Wait 10 seconds
sleep 10

# Test connection
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT 1;"
```

---

### Code Changes Not Reflecting

```bash
# Rebuild containers
docker compose down
docker compose up -d --build
```

---

### Reset Test Data

```bash
# Delete all test invitations
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative << 'EOF'
DELETE FROM project_invitations 
WHERE email LIKE '%@example.com';
EOF
```

---

## 🎯 Testing Checklist

Use this checklist to track your testing:

```
Basic Functionality:
[ ] Application loads at http://localhost:3000
[ ] Can create account / login
[ ] Can create a new project
[ ] Can view project page

Invitation System:
[ ] Can see "Invite Collaborator" button (if component added)
[ ] Can open invitation modal
[ ] Can send invitation successfully
[ ] Invitation URL is generated
[ ] Can copy invitation URL
[ ] Email notification logged to console
[ ] Can open invitation URL in browser
[ ] Invitation details displayed correctly
[ ] Can accept invitation
[ ] Collaborator added to project
[ ] Can see collaborator in members list
[ ] Collaborator can access project

Error Cases:
[ ] Duplicate invitation prevented
[ ] Invalid email rejected
[ ] Wrong email cannot accept
[ ] Expired invitation rejected

Additional Features:
[ ] Can revoke pending invitation
[ ] Can reject invitation (no login)
[ ] Can remove collaborator
[ ] Role badges display correctly

Database:
[ ] Invitations stored in database
[ ] Status updates correctly
[ ] Timestamps recorded
```

---

## 📚 Additional Resources

### Full Documentation

For comprehensive testing guide:
```bash
open docs/PHASE_1_MANUAL_TESTING_GUIDE.md
```

### Quick Reference

For all commands:
```bash
open docs/TESTING_QUICK_REFERENCE.md
```

### Health Check

Run anytime to verify system:
```bash
./test-health.sh
```

---

## 🚀 Quick Commands Reference

### Start Application
```bash
docker compose up -d
```

### Stop Application
```bash
docker compose down
```

### Restart Application
```bash
docker compose restart
```

### View Logs
```bash
docker logs -f dyad-collaborative-app-1
```

### Health Check
```bash
./test-health.sh
```

### Database Connection
```bash
docker exec -it dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative
```

---

## ✅ Success Criteria

Your testing is successful when:

- ✅ Application loads without errors
- ✅ Can create and login to account
- ✅ Can create projects
- ✅ Can send invitations (if UI component added)
- ✅ Email notifications logged
- ✅ Can accept invitations
- ✅ Collaborators added successfully
- ✅ All error cases handled properly
- ✅ Database updates correctly

---

## 🎉 Summary

**Application Status:** ✅ Running at http://localhost:3000  
**Health Check:** 16/16 Tests Passing (100%)  
**Ready For:** Manual testing of invitation system  

**Next Steps:**
1. Open http://localhost:3000 in browser
2. Login or create account
3. Create a test project
4. Follow testing steps above
5. Report any issues found

**Need Help?**
- Full guide: `docs/PHASE_1_MANUAL_TESTING_GUIDE.md`
- Quick reference: `docs/TESTING_QUICK_REFERENCE.md`
- Health check: `./test-health.sh`

---

**Good luck with testing! 🚀**

_Last Updated: November 6, 2025_  
_Application: Dyad Collaborative - Phase 1 Invitation System_
