# 📋 Phase 1 Testing Checklist

**Print this page or keep it open during testing**

---

## ✅ PRE-TESTING VERIFICATION (Complete ✓)

- [x] **Docker Containers Running**
  - dyad-collaborative-app-1: ✅ Up 8 minutes
  - dyad-collaborative-db-1: ✅ Up 8 minutes (healthy)
  - dyad-collaborative-redis-1: ✅ Up 8 minutes (healthy)

- [x] **Files Created**
  - invitation-manager.ts: ✅ 15,146 bytes
  - email-service.ts: ✅ 7,323 bytes
  - InviteCollaboratorModal.tsx: ✅ 7,370 bytes
  - CollaboratorsList.tsx: ✅ 11,389 bytes
  - invitation/[token]/page.tsx: ✅ Created

- [x] **Database Status**
  - project_invitations table: ✅ Exists
  - Current invitations: 0 (clean slate)

- [x] **App Status**
  - HTTP endpoint: ✅ Responding
  - Port 3000: ✅ Listening

---

## 🧪 MANUAL TESTING TASKS

### PHASE 1: System Verification (Start Here)

- [ ] **Test 1.1: Database Schema**
  - Command: `docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "\d project_invitations"`
  - ✓ Verify: Shows 12 columns
  - ✓ Verify: Shows 9 indexes
  - Result: _______________

- [ ] **Test 1.2: API Endpoints**
  - Command: `curl http://localhost:3000/api/projects/test-id/invitations`
  - ✓ Expected: `{"error":"Unauthorized"}`
  - Result: _______________

- [ ] **Test 1.3: File Structure**
  - ✓ All files exist (already verified above)
  - Result: ✅ PASS

---

### PHASE 2: UI Integration (30 minutes)

- [ ] **Test 2.1: Find Project Page**
  - Command: `find src/app -name "page.tsx" | grep project`
  - Location found: _______________
  - Notes: _______________

- [ ] **Test 2.2: Add CollaboratorsList**
  - File: _______________
  - Added import: [ ] Yes [ ] No
  - Added component: [ ] Yes [ ] No
  - TypeScript errors: [ ] None [ ] See below
  - Errors: _______________

- [ ] **Test 2.3: Verify Rendering**
  - Rebuild needed: [ ] Yes [ ] No
  - Component visible: [ ] Yes [ ] No
  - Shows "Members" section: [ ] Yes [ ] No
  - Shows "Invite" button: [ ] Yes [ ] No
  - Screenshot: _______________

---

### PHASE 3: Happy Path (15 minutes)

- [ ] **Test 3.1: Send Invitation**
  - Opened modal: [ ] Yes [ ] No
  - Email entered: _______________
  - Role selected: [ ] Editor [ ] Viewer
  - Success message: [ ] Yes [ ] No
  - Got invitation URL: [ ] Yes [ ] No
  - URL: _______________

- [ ] **Test 3.2: Email Notification**
  - Command: `docker logs dyad-collaborative-app-1 2>&1 | grep "EMAIL NOTIFICATION"`
  - Email found in logs: [ ] Yes [ ] No
  - Contains URL: [ ] Yes [ ] No
  - URL matches: [ ] Yes [ ] No

- [ ] **Test 3.3: View Invitation**
  - Opened URL: _______________
  - Page loads: [ ] Yes [ ] No
  - Shows project name: [ ] Yes [ ] No
  - Shows inviter name: [ ] Yes [ ] No
  - Shows role: [ ] Yes [ ] No
  - Shows expiration: [ ] Yes [ ] No

- [ ] **Test 3.4: Accept Invitation**
  - Login required: [ ] Yes [ ] No [ ] Already logged in
  - Clicked "Accept": [ ] Yes
  - Success message: [ ] Yes [ ] No
  - Redirected to project: [ ] Yes [ ] No
  - Time: _____ seconds

- [ ] **Test 3.5: Verify Added**
  - See in members list: [ ] Yes [ ] No
  - Role badge correct: [ ] Yes [ ] No
  - Can access project: [ ] Yes [ ] No
  - Database check: [ ] Done (see below)
  - DB shows accepted: [ ] Yes [ ] No

---

### PHASE 4: Error Cases (20 minutes)

- [ ] **Test 4.1: Duplicate Invitation**
  - Same email again: _______________
  - Error message: [ ] Yes [ ] No
  - Message text: _______________
  - Prevented: [ ] Yes [ ] No

- [ ] **Test 4.2: Invalid Email**
  - Tried: _______________
  - Client validation: [ ] Yes [ ] No
  - Prevented submission: [ ] Yes [ ] No

- [ ] **Test 4.3: Expired Invitation**
  - Manually expired: [ ] Done
  - Tried to accept: [ ] Done
  - Error shown: [ ] Yes [ ] No
  - Message: _______________
  - HTTP status: _______________

- [ ] **Test 4.4: Wrong Email**
  - Created for: _______________
  - Logged in as: _______________
  - Tried to accept: [ ] Done
  - Blocked: [ ] Yes [ ] No
  - Error message: _______________

- [ ] **Test 4.5: Non-Owner Invite**
  - Tested: [ ] Via API [ ] Skipped (UI prevents)
  - Result: _______________

- [ ] **Test 4.6: Invalid Token**
  - URL: http://localhost:3000/invitations/fake-token
  - 404 error: [ ] Yes [ ] No
  - User-friendly message: [ ] Yes [ ] No

---

### PHASE 5: Additional Features (15 minutes)

- [ ] **Test 5.1: Revoke Invitation**
  - Found pending invitation: [ ] Yes [ ] No
  - Clicked "Revoke": [ ] Yes
  - Confirmation dialog: [ ] Yes [ ] No
  - Removed from list: [ ] Yes [ ] No
  - URL now invalid: [ ] Yes [ ] No

- [ ] **Test 5.2: Reject Invitation**
  - Created new invitation: _______________
  - Opened URL (no login): [ ] Done
  - Clicked "Decline": [ ] Done
  - Success message: [ ] Yes [ ] No
  - No login required: [ ] Confirmed

- [ ] **Test 5.3: Remove Collaborator**
  - Found collaborator: _______________
  - Clicked "Remove": [ ] Done
  - Confirmation: [ ] Yes [ ] No
  - Removed from list: [ ] Yes [ ] No
  - Access revoked: [ ] Yes [ ] No

- [ ] **Test 5.4: Role Badges**
  - Owner badge (blue): [ ] Correct
  - Editor badge (gray): [ ] Correct
  - Viewer badge (outline): [ ] Correct

---

### PHASE 6: Edge Cases (10 minutes)

- [ ] **Test 6.1: Invite Existing Collaborator**
  - Tested: [ ] Yes [ ] No
  - Prevented: [ ] Yes [ ] No
  - Error message: _______________

- [ ] **Test 6.2: Accept Twice**
  - Tested: [ ] Yes [ ] No
  - Result: _______________

- [ ] **Test 6.3: Remove Self**
  - Button disabled: [ ] Yes [ ] No

- [ ] **Test 6.4: Long Expiration**
  - Tested: [ ] Yes [ ] No [ ] Skipped
  - Result: _______________

---

## 📊 SUMMARY

**Total Tests:** 30  
**Completed:** _____  
**Passed:** _____  
**Failed:** _____  
**Skipped:** _____  

**Pass Rate:** _____% 

**Time Taken:** _____ minutes

---

## 🐛 ISSUES FOUND

### Critical (P0) - Blocks Core Functionality
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### High (P1) - Significant Impact
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Medium (P2) - Minor Issues
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Low (P3) - Nice-to-Have
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## 💡 RECOMMENDATIONS

### Should Fix Before Production:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Can Fix Later:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### UI/UX Improvements:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## ✅ APPROVAL

**Phase 1 Testing Status:** [ ] APPROVED [ ] NEEDS WORK [ ] BLOCKED

**Approver:** _______________  
**Date:** _______________  
**Signature:** _______________

**Next Steps:**
- [ ] Fix critical issues
- [ ] Proceed to Task 8 (Automated Tests)
- [ ] Proceed to Task 9 (Permission System)
- [ ] Ready for Phase 2 (Real-Time Features)

---

## 📸 SCREENSHOTS

Attach or reference screenshots here:

1. **Invite Modal:** _______________
2. **Collaborators List:** _______________
3. **Invitation Page:** _______________
4. **Success State:** _______________
5. **Error Examples:** _______________

---

**Testing Guide:** `docs/PHASE_1_MANUAL_TESTING_GUIDE.md`  
**Quick Reference:** `docs/TESTING_QUICK_REFERENCE.md`  
**Implementation Summary:** `docs/PHASE_1_COMPLETE_SUMMARY.md`

---

_Last Updated: November 6, 2025_  
_Phase 1: Invitation System - 78% Complete_
