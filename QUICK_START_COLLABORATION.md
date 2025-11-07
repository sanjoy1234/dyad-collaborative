# 🚀 Real-Time Collaboration - Quick Start Guide

## ⚡ 5-Minute Test (Follow These Exact Steps)

### Step 1: Login as Owner (30 seconds)
1. Open browser: **http://localhost:3000**
2. Click **"Login"**
3. Enter credentials:
   - Email: **dev1@test.com**
   - Password: **Test123!**
4. Click **"Sign In"**
5. You'll see **Dashboard** with projects

### Step 2: Open Project (15 seconds)
1. Click on **"test 59"** project (or any project)
2. Editor opens with:
   - Left: File tree
   - Center: Preview/Code/Diff tabs
   - Right: AI Assistant
3. You should see at top right:
   - **"Collaborators (1)"** button
   - **"Start Preview"** button
   - **"Configure Model"** button

### Step 3: Add Collaborator (45 seconds)
1. Click **"Collaborators (1)"** button in top bar
2. **Panel slides in from right** ✅
3. You'll see:
   - **"Collaborators"** header
   - **"0 members, 1 pending"** (or similar)
   - **"Members"** section showing just you (dev1)
4. Click **"Add Collaborator"** button (blue, primary)
5. **Modal opens** titled "Add Collaborator (Direct)"
6. Click on **"Dev2 (Test Account)"** button (it will highlight)
7. Verify **"Editor"** radio button is selected
8. Click **"Add Collaborator"** button at bottom
9. **Success toast** appears: "Collaborator Added!"
10. **Modal closes** automatically
11. **Panel refreshes** - you now see **dev2@test.com** in Members section ✅

### Step 4: Open Second Browser Session (30 seconds)
1. Open **Incognito/Private window** (Cmd+Shift+N or Ctrl+Shift+N)
2. Go to: **http://localhost:3000**
3. Click **"Login"**
4. Enter credentials:
   - Email: **dev2@test.com**
   - Password: **Test123!**
5. Click **"Sign In"**

### Step 5: Verify Access (30 seconds)
1. In dev2's window, look at **Dashboard**
2. You should see **"test 59" project** ✅
3. Click on **"test 59"** to open it
4. Editor opens successfully (no 403 error) ✅
5. You see the same file tree and interface

### Step 6: See Live Presence (30 seconds)
1. **Keep both browser windows visible** (side-by-side)
2. Look at **top bar** in **BOTH windows**
3. You should see:
   - ✅ **"Live" badge** (green with pulse animation)
   - ✅ **Two avatar circles** (colored circles with letters "D")
   - ✅ Hover over avatars: Shows "dev1 (owner)" and "dev2 (editor)"
4. **This means real-time collaboration is working!** 🎉

### Step 7: Test Monaco Editor (1 minute)
1. In **either window**, click on **"package.json"** file in file tree
2. **Code tab** opens with **Monaco Editor** ✅
3. You should see:
   - ✅ Full-height editor (not a tiny strip!)
   - ✅ JSON syntax highlighting (colored text)
   - ✅ Line numbers on left
   - ✅ Minimap on right
   - ✅ File path at top: "package.json"
   - ✅ File type badge: "json"
4. **Edit the file**: Add a comment or change a value
5. **"Modified" badge** appears (orange) ✅
6. **"Save" button** appears in top bar ✅
7. Click **"Save"** or press **Cmd+S** (Mac) / **Ctrl+S** (Windows)
8. **File saves successfully** ✅
9. **"Modified" badge disappears** ✅

### Step 8: Verify Real-Time Connection (30 seconds)
1. Open **Browser Console** in both windows (Press **F12**)
2. Click **"Console"** tab
3. Look for these messages:
   ```
   [Collaboration] Connected to server
   [Collaboration] Active users: 2
   ```
4. If you see these messages: **Socket.IO is working!** ✅

### Step 9: Test File Navigation Tracking (30 seconds)
1. In **dev1's window**, click on **"index.html"**
2. In **dev2's console** (F12 → Console), you should see:
   ```
   [Collaboration] User opened file: dev1 /path/to/index.html
   ```
3. This confirms **real-time file tracking is active!** ✅

### Step 10: Test Viewer Role (Optional - 1 minute)
1. In **dev1's window**, click **"Collaborators"** again
2. Click **"Add Collaborator"**
3. Select **"Dev3 (Test Account)"**
4. Select **"Viewer"** radio button (read-only)
5. Click **"Add Collaborator"**
6. Open **third browser window** (another incognito)
7. Login as **dev3@test.com** / **Test123!**
8. Open **"test 59"** project
9. Click on any file
10. Monaco Editor opens with **"Read-only" badge** ✅
11. Try to edit - you **cannot** (editor is disabled) ✅

## ✅ Success Checklist

After completing all steps, verify:

- [ ] dev1 logged in successfully
- [ ] dev2 added as collaborator
- [ ] dev2 can see project in dashboard
- [ ] Both users see "Live" badge
- [ ] Avatar circles show (2 users)
- [ ] Monaco Editor displays full height
- [ ] Syntax highlighting works
- [ ] File editing works (Modified badge)
- [ ] File saving works (Cmd+S or Click Save)
- [ ] Console logs show Socket.IO connection
- [ ] Console logs show active users: 2
- [ ] File navigation tracked in console
- [ ] (Optional) Viewer role is read-only

## 🎉 All Features Working?

**If ALL checkboxes are checked:** 
✅ **Real-time collaboration is fully functional!**

**If ANY checkbox is unchecked:**
See **REALTIME_COLLABORATION_TESTING.md** for detailed troubleshooting

## 🐛 Quick Troubleshooting

### Issue: "Live" Badge Not Appearing
**Solution:** Hard refresh both browsers (Cmd+Shift+R)

### Issue: Cannot Add Collaborator
**Solution:** Verify user exists with:
```bash
docker exec -i dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT email FROM users WHERE email LIKE '%test.com';"
```

### Issue: Monaco Editor Not Full Height
**Solution:** 
1. Clear browser cache completely
2. Hard refresh (Cmd+Shift+R)
3. Try incognito window

### Issue: Socket.IO Not Connecting
**Solution:** Check server logs:
```bash
docker logs dyad-collaborative-app-1 --tail 50
```

### Issue: Console Errors
**Solution:** 
1. Take screenshot of error
2. Check Network tab (F12 → Network)
3. Look for failed requests (red)

## 📞 Need Help?

1. Check **REALTIME_COLLABORATION_TESTING.md** for full test suite
2. Check **COLLABORATION_IMPLEMENTATION_SUMMARY.md** for technical details
3. Review browser console (F12) for error messages
4. Check Docker logs: `docker logs dyad-collaborative-app-1`

## 🎯 What's Next?

Once basic testing is complete:

1. **Test with all 3 accounts** (dev1, dev2, dev3)
2. **Test removing collaborators**
3. **Test with multiple projects**
4. **Test simultaneous editing** (both edit same file)
5. **Test Socket.IO reconnection** (restart Docker)

See **REALTIME_COLLABORATION_TESTING.md** for advanced tests!

---

**Total Time:** ~5 minutes for basic test, 15 minutes for full test

**Ready to go?** Start with **Step 1** above! 🚀
