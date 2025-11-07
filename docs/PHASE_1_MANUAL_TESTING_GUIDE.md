# Phase 1 Manual Testing Guide - Invitation System

**Date:** November 6, 2025  
**Status:** Ready for Testing  
**App URL:** http://localhost:3000  
**Containers:** ✅ All Running

---

## 📋 Pre-Testing Checklist

### ✅ System Status
```bash
# Verify containers are running
docker ps | grep dyad

# Expected output:
# dyad-collaborative-app-1     Up X minutes    0.0.0.0:3000->3000/tcp
# dyad-collaborative-db-1      Up X minutes    0.0.0.0:5432->5432/tcp
# dyad-collaborative-redis-1   Up X minutes    0.0.0.0:6379->6379/tcp
```

### ✅ Database Schema
```bash
# Verify project_invitations table exists
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "\d project_invitations"

# Should show 12 columns and 9 indexes
```

### ✅ App Health
```bash
# Test app is responding
curl http://localhost:3000

# Should return HTML (200 OK)
```

---

## 🧪 Test Suite Overview

We'll test in this order:
1. **System Verification** - Database, API endpoints, file structure
2. **UI Integration** - Add components to project page
3. **Happy Path Flow** - Complete invitation workflow
4. **Error Cases** - Test validation and edge cases
5. **Permission Checks** - Owner vs member access

---

## Test 1: System Verification 🔍

### 1.1 Database Schema Check
```bash
cd /Users/sanjoy.ghoshapexon.com/Library/CloudStorage/OneDrive-Apexon/demoworkspace/dyad-collaborative

docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative << 'EOF'
\d project_invitations
SELECT COUNT(*) FROM project_invitations;
EOF
```

**Expected Result:**
- Table has 12 columns (id, project_id, email, role, invited_by, invited_user_id, token, status, expires_at, accepted_at, created_at, updated_at)
- Shows 9 indexes
- Count returns 0 or existing invitations

**✅ Pass Criteria:** Table structure matches, no errors

---

### 1.2 API Endpoints Check
```bash
# Test authentication requirement
curl -X GET http://localhost:3000/api/projects/test-id/invitations

# Expected: {"error":"Unauthorized","code":"UNAUTHORIZED"}

# Test public invitation endpoint
curl -X GET http://localhost:3000/api/invitations/invalid-token

# Expected: {"error":"Invitation not found","code":"INVITATION_NOT_FOUND"}
```

**✅ Pass Criteria:** Both endpoints return expected error responses

---

### 1.3 File Structure Check
```bash
# Verify all new files exist
ls -la src/lib/collaboration/invitation-manager.ts
ls -la src/lib/email/email-service.ts
ls -la src/components/collaboration/InviteCollaboratorModal.tsx
ls -la src/components/collaboration/CollaboratorsList.tsx
ls -la src/app/invitations/[token]/page.tsx
ls -la src/app/api/projects/[projectId]/invitations/route.ts
```

**✅ Pass Criteria:** All files exist with no errors

---

## Test 2: UI Integration 🎨

### 2.1 Find Your Project Detail Page

First, identify which file renders your project detail page. Common locations:
```bash
# Search for project detail pages
find src/app -name "page.tsx" | grep -E "projects/\[|project/\["

# Or search for "Project" component
grep -r "function.*Project" src/app --include="*.tsx" | head -10
```

**Likely locations:**
- `src/app/projects/[projectId]/page.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/app/dashboard/projects/[projectId]/page.tsx`

### 2.2 Add CollaboratorsList Component

Once you've found your project detail page, add this import at the top:

```typescript
import { CollaboratorsList } from '@/components/collaboration/CollaboratorsList';
```

Then add the component in the JSX (good place: after project header, before file list):

```typescript
{/* Add this section */}
<div className="mb-6">
  <CollaboratorsList
    projectId={projectId}
    projectName={project.name}
    currentUserId={session.user.id}
    isOwner={project.owner_id === session.user.id}
  />
</div>
```

**Example Integration:**
```typescript
export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const session = await auth();
  if (!session) redirect('/login');

  const project = await getProject(params.projectId, session.user.id);
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{project.name}</h1>
      
      {/* ADD COLLABORATORS SECTION HERE */}
      <div className="mb-6">
        <CollaboratorsList
          projectId={params.projectId}
          projectName={project.name}
          currentUserId={session.user.id}
          isOwner={project.owner_id === session.user.id}
        />
      </div>
      
      {/* Rest of your project page */}
      <div className="mt-6">
        {/* Files, preview, etc. */}
      </div>
    </div>
  );
}
```

### 2.3 Verify Component Renders

```bash
# Rebuild to include changes (if needed)
docker compose up -d --build

# Or if using hot reload, just save the file
```

**✅ Pass Criteria:**
- No TypeScript errors
- Component renders on project page
- Shows "Members" section
- Shows "Invite Collaborator" button (if owner)

---

## Test 3: Happy Path Flow 🎉

### 3.1 Send Invitation (UI)

1. **Login as Project Owner**
   - Navigate to http://localhost:3000
   - Login with your account
   - Open a project you own

2. **Open Invite Modal**
   - Click "Invite Collaborator" button
   - Modal should open with form

3. **Fill Form**
   - Email: `colleague@example.com` (any valid email)
   - Role: Select "Editor"
   - Click "Send Invitation"

4. **Verify Success**
   - Should see success message
   - Should see invitation URL
   - Should see "Copy Link" button
   - Modal should show success state

5. **Copy Invitation URL**
   - Click "Copy Link"
   - Should see "Link copied!" toast
   - URL format: `http://localhost:3000/invitations/[64-char-token]`

**✅ Pass Criteria:**
- Modal opens/closes smoothly
- Form validation works (try invalid email first)
- Success message appears
- URL is copyable

---

### 3.2 Check Email Notification (Console)

```bash
# Check Docker logs for email output
docker logs dyad-collaborative-app-1 2>&1 | grep -A 30 "========== EMAIL NOTIFICATION =========="

# Should see formatted email with:
# - To: colleague@example.com
# - Subject: Invitation to collaborate on [Project Name]
# - Invitation URL
# - Beautiful HTML template
```

**✅ Pass Criteria:**
- Email logged to console
- Contains invitation URL
- Invitation URL matches URL in success modal

---

### 3.3 View Invitation Details (Public Page)

1. **Open Invitation URL**
   - Use URL from step 3.1 (or copy from console logs)
   - Open in browser: `http://localhost:3000/invitations/[token]`

2. **Verify Page Content**
   - Shows project name
   - Shows inviter name (your name)
   - Shows invited email
   - Shows role: "Editor - You can view and edit"
   - Shows expiration date
   - Shows "Accept Invitation" button
   - Shows "Decline" button

**✅ Pass Criteria:**
- Page loads without errors
- All information displayed correctly
- No authentication required to view
- Buttons are clickable

---

### 3.4 Accept Invitation

**If NOT Logged In:**
1. Click "Accept Invitation"
2. Should redirect to `/login?redirect=/invitations/[token]`
3. Login with account matching the invitation email
4. Should auto-redirect back to invitation page
5. Should auto-accept invitation
6. Should show success message
7. Should redirect to project page after 2 seconds

**If Already Logged In:**
1. Ensure logged in email matches invitation email
2. Click "Accept Invitation"
3. Should show success message immediately
4. Should redirect to project page after 2 seconds

**✅ Pass Criteria:**
- Acceptance succeeds
- Redirects to project page
- No errors in browser console
- No errors in Docker logs

---

### 3.5 Verify Collaborator Added

1. **As Project Owner:**
   - Navigate back to project page
   - Refresh page (or wait for component to refresh)
   - Should see new collaborator in "Members" section
   - Should show their email and role badge "Editor"

2. **As New Collaborator:**
   - Should now see project in project list
   - Should be able to open project
   - Should be able to view files

3. **Check Database:**
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative << 'EOF'
SELECT 
  pi.email, 
  pi.role, 
  pi.status, 
  pi.accepted_at,
  u.email as inviter_email
FROM project_invitations pi
LEFT JOIN users u ON pi.invited_by = u.id
WHERE pi.status = 'accepted'
ORDER BY pi.accepted_at DESC
LIMIT 5;
EOF
```

**Expected:** Shows accepted invitation with timestamp

**✅ Pass Criteria:**
- Collaborator appears in UI
- Database shows accepted status
- New user can access project

---

## Test 4: Error Cases 🚨

### 4.1 Duplicate Invitation

1. **Try to invite same email again:**
   - Click "Invite Collaborator"
   - Enter `colleague@example.com` (already invited)
   - Select "Editor"
   - Click "Send Invitation"

**Expected Result:** 
- Error toast: "Invitation already pending for this email"
- Or: "User already has invitation for this project"

**✅ Pass Criteria:** Duplicate prevented with clear error message

---

### 4.2 Invalid Email Format

1. **Try invalid email:**
   - Click "Invite Collaborator"
   - Enter `not-an-email` (no @)
   - Try to submit

**Expected Result:** Form validation error before submission

**✅ Pass Criteria:** Client-side validation prevents submission

---

### 4.3 Expired Invitation

```bash
# Manually expire an invitation in database
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative << 'EOF'
UPDATE project_invitations
SET expires_at = NOW() - INTERVAL '1 day',
    status = 'expired'
WHERE email = 'colleague@example.com'
AND status = 'pending'
LIMIT 1;
EOF
```

Now try to accept the expired invitation:
1. Open invitation URL
2. Click "Accept Invitation"

**Expected Result:**
- Error page or message: "This invitation has expired"
- HTTP 410 Gone status

**✅ Pass Criteria:** Expired invitation rejected with clear message

---

### 4.4 Wrong Email Accepts

1. **Create new invitation** for `user-a@example.com`
2. **Login as different user** (user-b@example.com)
3. **Try to accept invitation** meant for user-a

**Expected Result:**
- Error message: "This invitation was sent to user-a@example.com"
- HTTP 403 Forbidden
- Invitation not accepted

**✅ Pass Criteria:** Email mismatch prevented

---

### 4.5 Non-Owner Tries to Invite

This requires API testing since UI only shows button to owners:

```bash
# Get a valid auth token for a non-owner user
# Then try to send invitation via API

curl -X POST http://localhost:3000/api/projects/[project-id]/invitations \
  -H "Authorization: Bearer [non-owner-token]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "editor"
  }'
```

**Expected Result:**
- HTTP 403 Forbidden
- Error: "Only project owner can send invitations"

**✅ Pass Criteria:** Non-owners cannot send invitations

---

### 4.6 Invalid Token

1. **Open URL with fake token:**
   - `http://localhost:3000/invitations/fake-token-123`

**Expected Result:**
- Error page: "Invitation not found"
- HTTP 404 Not Found

**✅ Pass Criteria:** Invalid tokens handled gracefully

---

## Test 5: Additional Features 🔧

### 5.1 Revoke Invitation (Owner)

1. **As Project Owner:**
   - Go to project page
   - Find "Pending Invitations" section
   - Should see invitation you sent
   - Click "Revoke" button
   - Confirm revocation

2. **Verify Revoked:**
   - Invitation removed from pending list
   - Try to accept invitation URL → Should fail
   - Error: "Invitation has been revoked"

**✅ Pass Criteria:** Revocation works, URL becomes invalid

---

### 5.2 Reject Invitation (Public)

1. **Create new invitation** for `reject-test@example.com`
2. **Open invitation URL** (don't login)
3. **Click "Decline" button**
4. **Confirm rejection**

**Expected Result:**
- Success message: "You have declined this invitation"
- Status changed to "rejected"
- No login required
- Cannot accept after rejecting

**✅ Pass Criteria:** Rejection works without authentication

---

### 5.3 Remove Collaborator (Owner)

1. **As Project Owner:**
   - Go to project page
   - Find accepted collaborator in "Members" section
   - Click "Remove" button (trash icon)
   - Confirm removal

2. **Verify Removed:**
   - Collaborator removed from members list
   - User can no longer access project

**✅ Pass Criteria:** Removal works, access revoked

---

### 5.4 Role Badge Display

**Verify role badges show correctly:**
- **Owner** → Blue badge
- **Editor** → Gray badge  
- **Viewer** → Outline badge

**Create a viewer invitation** to test:
1. Click "Invite Collaborator"
2. Enter `viewer@example.com`
3. Select "Viewer" role
4. Send invitation
5. Accept invitation
6. Check badge displays correctly

**✅ Pass Criteria:** All role badges display with correct styles

---

## Test 6: Edge Cases 🎯

### 6.1 Invite Existing Collaborator

1. **Try to invite** someone already a collaborator
2. **Expected:** Error message preventing duplicate

### 6.2 Accept Already Accepted Invitation

1. **Accept an invitation**
2. **Try to accept same URL again**
3. **Expected:** Message saying already accepted, redirect to project

### 6.3 Owner Tries to Remove Self

1. **Try to remove yourself** (as owner)
2. **Expected:** Remove button disabled for self

### 6.4 Very Long Expiration Time

```bash
# Create invitation with 1 year expiration
# Test via API or modify database
```

**Expected:** Accepts any reasonable expiration time

---

## 📊 Test Results Template

Use this checklist to track your testing:

```
PHASE 1 MANUAL TEST RESULTS
Date: _______________
Tester: _____________

[ ] Test 1.1: Database Schema Check
    Result: _______________
    Notes: _______________

[ ] Test 1.2: API Endpoints Check
    Result: _______________
    Notes: _______________

[ ] Test 1.3: File Structure Check
    Result: _______________
    Notes: _______________

[ ] Test 2.1: Find Project Detail Page
    Location: _______________

[ ] Test 2.2: Add CollaboratorsList Component
    Result: _______________
    Issues: _______________

[ ] Test 2.3: Verify Component Renders
    Result: _______________
    Screenshot: _______________

[ ] Test 3.1: Send Invitation (UI)
    Result: _______________
    Invitation URL: _______________

[ ] Test 3.2: Check Email Notification
    Result: _______________
    Email Found: Yes / No

[ ] Test 3.3: View Invitation Details
    Result: _______________
    All Fields Displayed: Yes / No

[ ] Test 3.4: Accept Invitation
    Result: _______________
    Redirect Worked: Yes / No

[ ] Test 3.5: Verify Collaborator Added
    Result: _______________
    Shows in UI: Yes / No
    Shows in DB: Yes / No

[ ] Test 4.1: Duplicate Invitation
    Result: _______________
    Error Message: _______________

[ ] Test 4.2: Invalid Email Format
    Result: _______________
    Validation Works: Yes / No

[ ] Test 4.3: Expired Invitation
    Result: _______________
    Proper Error: Yes / No

[ ] Test 4.4: Wrong Email Accepts
    Result: _______________
    Blocked Correctly: Yes / No

[ ] Test 4.5: Non-Owner Tries to Invite
    Result: _______________
    Blocked Correctly: Yes / No

[ ] Test 4.6: Invalid Token
    Result: _______________
    404 Returned: Yes / No

[ ] Test 5.1: Revoke Invitation
    Result: _______________
    URL Invalidated: Yes / No

[ ] Test 5.2: Reject Invitation
    Result: _______________
    No Login Required: Yes / No

[ ] Test 5.3: Remove Collaborator
    Result: _______________
    Access Revoked: Yes / No

[ ] Test 5.4: Role Badge Display
    Owner Badge: _______________
    Editor Badge: _______________
    Viewer Badge: _______________

OVERALL RESULT: Pass / Fail / Partial
CRITICAL ISSUES: _______________
MINOR ISSUES: _______________
RECOMMENDATIONS: _______________
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module '@/components/collaboration/CollaboratorsList'"

**Solution:** Check import path matches your tsconfig.json baseUrl. Try:
```typescript
import { CollaboratorsList } from '../../../components/collaboration/CollaboratorsList';
```

### Issue: Component renders but shows "Unauthorized" error

**Solution:** Check that `session.user.id` exists and is being passed correctly.

### Issue: Email not showing in Docker logs

**Solution:** Check email service is being called:
```bash
docker logs dyad-collaborative-app-1 2>&1 | grep -i "email"
```

### Issue: Invitation URL doesn't work

**Solution:** Verify token format is correct (64-char hex). Check database:
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT token, status, expires_at FROM project_invitations LIMIT 5;"
```

### Issue: "Table project_invitations doesn't exist"

**Solution:** Run migration:
```bash
cat migrations/004_alter_collaboration_invitations.sql | docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative
```

---

## 📝 Next Steps After Testing

### If All Tests Pass:
1. Document any UI/UX improvements needed
2. Proceed to Task 8 (Automated Integration Tests)
3. Proceed to Task 9 (Permission System)

### If Tests Fail:
1. Document all issues with:
   - Test name
   - Expected behavior
   - Actual behavior
   - Error messages
   - Screenshots (if applicable)
2. Share with development team
3. Prioritize fixes:
   - **P0 (Critical):** Blocks core functionality
   - **P1 (High):** Impacts user experience significantly
   - **P2 (Medium):** Minor issues, workarounds exist
   - **P3 (Low):** Nice-to-have improvements

### Test Report Template:

```markdown
# Phase 1 Manual Test Report

**Date:** November 6, 2025
**Tester:** [Your Name]
**Environment:** Docker local development

## Summary
- Total Tests: 20
- Passed: __
- Failed: __
- Blocked: __

## Critical Issues (P0)
1. [Issue description]
   - Test: [Test name]
   - Impact: [How it blocks users]
   - Steps to reproduce: [...]

## High Priority Issues (P1)
[...]

## Recommendations
[...]

## Screenshots
[Attach relevant screenshots]
```

---

## 🎯 Success Criteria

Phase 1 Manual Testing is **COMPLETE** when:

- ✅ All system verification tests pass
- ✅ UI components integrated successfully
- ✅ Complete invitation workflow works end-to-end
- ✅ Error cases handled gracefully
- ✅ No critical bugs found
- ✅ Email notifications working (console logs)
- ✅ Database operations validated
- ✅ All 20 test scenarios documented

---

**Ready to start testing!** 🚀

Begin with Test 1 (System Verification) and work through sequentially. Document all results and issues as you go.

Good luck! 🎉
