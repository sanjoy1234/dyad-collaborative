# Real-Time Collaboration Testing Guide

## 🎯 Objective
Test real-time collaboration features between multiple test accounts (dev1, dev2, dev3)

## 🔑 Test Accounts
- **dev1@test.com** / Test123!
- **dev2@test.com** / Test123!
- **dev3@test.com** / Test123!

## ✅ Feature Checklist

### Phase 1: Direct Collaborator Addition (✅ Completed)

#### Test 1: Add Collaborator Directly
1. **Login as dev1@test.com**
2. **Navigate to a project** (e.g., test 59)
3. **Click "Collaborators (1)" button** in top bar
4. **Collaborators panel** should slide in from right
5. **Click "Add Collaborator" button** (primary button)
6. **Modal opens** with test account selection
7. **Click "Dev2 (Test Account)"** to select dev2@test.com
8. **Select role**: Editor
9. **Click "Add Collaborator"**
10. **Success toast** appears: "Collaborator Added!"
11. **Panel refreshes** - dev2 now appears in Members section
12. **Repeat** to add dev3@test.com

**Expected Result:**
- ✅ dev2@test.com added as Editor
- ✅ dev3@test.com added as Editor
- ✅ Both visible in Members list
- ✅ No email verification required
- ✅ Instant access granted

#### Test 2: Access from Collaborator Account
1. **Open new incognito window**
2. **Login as dev2@test.com**
3. **Go to Dashboard**
4. **Project "test 59" should be visible** in projects list
5. **Click on project** to open editor
6. **Verify access granted** (no 403 error)

**Expected Result:**
- ✅ dev2 can see project in dashboard
- ✅ dev2 can open project editor
- ✅ dev2 sees role badge: "Editor"

### Phase 2: Real-Time Presence (✅ Completed)

#### Test 3: Live User Indicators
1. **Keep dev1 session open** in one browser
2. **Open dev2 session** in incognito window
3. **Both navigate to same project** (test 59)
4. **Look at top bar** near project name

**Expected Result:**
- ✅ Both users see **"Live" badge** (green with pulse animation)
- ✅ **Avatar circles** show active users (colored circles with initials)
- ✅ **Hover over avatars** shows username and role
- ✅ If 3+ users: Shows "+N" for additional users

#### Test 4: Collaborators Panel Updates
1. **With dev1 and dev2 both in project**
2. **Open Collaborators panel** on dev1
3. **Check Members section**

**Expected Result:**
- ✅ Shows "2 members, 0 pending"
- ✅ Lists both dev1 (owner) and dev2 (editor)
- ✅ Each has correct role badge
- ✅ Shows join date

### Phase 3: File Collaboration (✅ Completed)

#### Test 5: Monaco Editor Full Height
1. **Click on any file** (e.g., package.json)
2. **Code tab opens**

**Expected Result:**
- ✅ Monaco Editor fills entire vertical space
- ✅ Syntax highlighting active (JSON colors)
- ✅ Line numbers visible on left
- ✅ Minimap visible on right
- ✅ File path shown at top
- ✅ File type badge shown
- ✅ Scrollable content

#### Test 6: File Editing
1. **As dev1: Open index.html**
2. **Edit some text** (add a comment)
3. **"Modified" badge appears** (orange)
4. **"Save" button appears** in top bar and above editor
5. **Press Cmd+S** or click Save
6. **File saves successfully**
7. **"Modified" badge disappears**

**Expected Result:**
- ✅ Real-time "Modified" state tracking
- ✅ Save button becomes active
- ✅ Keyboard shortcut (Cmd+S) works
- ✅ Click Save works
- ✅ Success toast on save

#### Test 7: Simultaneous Viewing (Socket.IO)
1. **dev1: Open package.json**
2. **dev2: Open package.json** (same file)
3. **Check browser console** (F12) on both

**Expected Result:**
- ✅ Console logs: "[Collaboration] Connected to server"
- ✅ Console logs: "[Collaboration] Active users: 2"
- ✅ Both see "Live" badge
- ✅ Both see each other's avatars
- ✅ Real-time presence updates

#### Test 8: File Navigation Tracking
1. **dev1: Click on index.js**
2. **Check dev2's console**

**Expected Result:**
- ✅ dev2's console logs: "[Collaboration] User opened file: dev1 /path/to/index.js"
- ✅ Real-time file navigation tracking active

### Phase 4: Role-Based Permissions (✅ Completed)

#### Test 9: Viewer Role (Read-Only)
1. **As dev1: Open Collaborators panel**
2. **Click "Add Collaborator"**
3. **Select dev3@test.com**
4. **Select role: Viewer**
5. **Add collaborator**
6. **Login as dev3** in separate window
7. **Open same project**
8. **Click on any file**

**Expected Result:**
- ✅ dev3 can view files
- ✅ Monaco Editor shows **"Read-only" badge**
- ✅ dev3 **cannot edit** (editor is read-only)
- ✅ No "Save" button appears for dev3

#### Test 10: Collaborator Removal
1. **As dev1 (owner): Open Collaborators panel**
2. **Find dev3 in Members list**
3. **Click "Remove" button** next to dev3
4. **Confirm removal**
5. **dev3 removed from list**
6. **Switch to dev3's window**
7. **Refresh dashboard**

**Expected Result:**
- ✅ dev3 no longer sees project in dashboard
- ✅ If dev3 tries to access project URL directly: 403 Forbidden
- ✅ Instant access revocation

## 🔍 Advanced Features Testing

### Test 11: Multiple Projects
1. **Create another project as dev1**
2. **Add dev2 to new project**
3. **Verify dev2 sees both projects**

### Test 12: Socket.IO Reconnection
1. **While dev1 and dev2 are in project**
2. **Restart Docker container**: `docker compose restart`
3. **Wait for restart (~30 seconds)**
4. **Check both browser windows**

**Expected Result:**
- ✅ Socket.IO auto-reconnects
- ✅ "Live" badge reappears after reconnection
- ✅ Presence updates resume

### Test 13: Concurrent Editing (Future Enhancement)
*Note: Full CRDT/OT not yet implemented - this is for future testing*
1. **dev1 and dev2 open same file**
2. **Both edit different lines**
3. **Both save**

**Expected:**
- ⏳ Last save wins (current implementation)
- 🎯 Future: Merge changes automatically

## 🐛 Common Issues & Solutions

### Issue: "Live" Badge Not Appearing
**Solutions:**
1. Hard refresh browser (Cmd+Shift+R)
2. Check browser console for Socket.IO errors
3. Verify `/api/socket` endpoint accessible
4. Check Docker logs: `docker logs dyad-collaborative-app-1`

### Issue: Collaborator Not Added
**Solutions:**
1. Verify user exists (account must be pre-created)
2. Check browser console for API errors
3. Verify database: `docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT * FROM project_collaborators;"`

### Issue: Monaco Editor Not Full Height
**Solutions:**
1. Clear browser cache completely
2. Hard refresh (Cmd+Shift+R)
3. Try incognito window
4. Check console for React errors

### Issue: Cannot Edit Files
**Solutions:**
1. Check role: Viewer role is read-only
2. Verify not in Preview tab (must be in Code tab)
3. Check if file is actually selected

## 📊 Success Criteria

### ✅ All Features Working:
- [x] Direct collaborator addition (no email)
- [x] Real-time presence indicators
- [x] Live badge and user avatars
- [x] Monaco Editor full height
- [x] File editing and saving
- [x] Socket.IO connection
- [x] Role-based permissions (Editor/Viewer)
- [x] Collaborator removal
- [x] Multi-browser sessions

### 🎯 Next Steps (Future Enhancements):
- [ ] Live cursor positions (show where others are typing)
- [ ] Operational Transform for concurrent editing
- [ ] File change notifications (toast when others edit)
- [ ] Audio/Video call integration
- [ ] Chat within editor
- [ ] Conflict resolution UI

## 🧪 Testing Workflow

### Quick Test (5 minutes):
1. Login as dev1
2. Add dev2 as collaborator
3. Login as dev2 in incognito
4. Both open same project
5. Verify "Live" badge shows
6. Both open same file
7. Edit and save

### Full Test (15 minutes):
1. Run Tests 1-10 in order
2. Document any failures
3. Check console logs on errors
4. Verify database state if issues

### Stress Test (Optional):
1. Add all 3 test accounts to same project
2. All open same file
3. All edit simultaneously
4. Verify performance

## 📝 Test Results Log

### Test Session: [DATE]
**Tested By:** [YOUR NAME]
**Environment:** macOS, Chrome/Firefox/Safari

| Test # | Feature | Status | Notes |
|--------|---------|--------|-------|
| 1 | Add Collaborator | ✅/❌ | |
| 2 | Access from Collaborator | ✅/❌ | |
| 3 | Live User Indicators | ✅/❌ | |
| 4 | Collaborators Panel | ✅/❌ | |
| 5 | Monaco Editor Height | ✅/❌ | |
| 6 | File Editing | ✅/❌ | |
| 7 | Simultaneous Viewing | ✅/❌ | |
| 8 | File Navigation Tracking | ✅/❌ | |
| 9 | Viewer Role | ✅/❌ | |
| 10 | Collaborator Removal | ✅/❌ | |

## 🎉 Verification Complete

Once all tests pass, collaboration features are ready for production use!

**Report any issues to the development team with:**
- Test number that failed
- Browser console logs
- Network tab (F12 → Network)
- Expected vs actual behavior
