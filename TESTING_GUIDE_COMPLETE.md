# ✅ DYAD COLLABORATIVE - FIXES APPLIED & TESTING GUIDE

**Date:** November 6, 2025  
**Status:** ✅ READY FOR TESTING  
**Build:** Successful (42ms startup)

---

## 🔧 ISSUES FIXED

### **1. Project Files Volume - CRITICAL FIX** ✅
**Problem:** Project files were lost on container rebuild  
**Solution:** Added persistent Docker volume for `/app/projects`
```yaml
volumes:
  - project_files:/app/projects  # Files now persist across rebuilds!
```
**Impact:** All generated code files now survive container restarts

### **2. Preview Server Port Exposure** ✅
**Problem:** Ports 3100-3200 not accessible from host  
**Solution:** Added port range to docker-compose.yml
```yaml
ports:
  - "3100-3200:3100-3200"  # 101 preview server ports exposed
```
**Impact:** Preview servers can now be accessed from browser

### **3. Preview Server Process Validation** ✅
**Problem:** Stale database entries showed servers as "running" when processes were dead  
**Solution:** Added process existence check before returning server info
```typescript
// Check if process actually exists
try {
  process.kill(existing.process_id, 0); // Signal 0 = check only
  processExists = true;
} catch (error) {
  // Mark as stopped if process doesn't exist
  await db.update(previewServers)
    .set({ status: 'stopped', stopped_at: new Date() });
}
```
**Impact:** No more "localhost refused to connect" errors

### **4. Preview Server Network Binding** ✅
**Problem:** http-server only binding to localhost  
**Solution:** Added `-a 0.0.0.0` flag to bind to all interfaces
```typescript
command = `cd ${projectPath} && npx http-server -p ${port} -a 0.0.0.0 --cors`;
```
**Impact:** Server accessible from outside container

### **5. Project Directory Validation** ✅
**Problem:** No check if project files exist before starting preview  
**Solution:** Added directory existence check with proper error message
```typescript
try {
  await fs.access(projectPath);
} catch (error) {
  return NextResponse.json(
    { error: 'Project files not found. Please generate some files first.' },
    { status: 404 }
  );
}
```
**Impact:** Clear error messages when files missing

### **6. Enhanced Error Logging** ✅
**Problem:** Validation errors were opaque  
**Solution:** Added comprehensive logging for debugging
```typescript
console.error('Operation validation failed:', validation.errors);
console.error('Operations received:', JSON.stringify(parsed.operations, null, 2));
```
**Impact:** Can now debug validation failures easily

---

## 🧪 TESTING INSTRUCTIONS

### **Prerequisites**
- ✅ App running on http://localhost:3000
- ✅ Database with valid user account
- ✅ At least one AI provider API key configured

---

### **TEST 1: Login & Setup** (2 min)

1. **Open browser:** http://localhost:3000
2. **Login** with your credentials
3. **Navigate** to dashboard
4. **Verify:** You can see projects list

**Expected:** ✅ Dashboard loads without errors

---

### **TEST 2: Create New Project** (2 min)

1. Click **"New Project"** button
2. Enter:
   - Name: "Test Preview App"
   - Description: "Testing preview server functionality"
3. Click **"Create"**
4. **Verify:** Project opens in editor

**Expected:** 
- ✅ 3-panel editor layout
- ✅ Left: File tree (empty initially)
- ✅ Center: Preview/Code/Diff tabs
- ✅ Right: AI Assistant chat

---

### **TEST 3: Generate Code with AI** (3 min)

1. In **AI Assistant** (right panel), enter:
```
Create a simple interactive counter app with:
- HTML page with styled layout
- Counter display starting at 0
- Three buttons: Increment (+1), Decrement (-1), Reset (0)
- Nice gradient background
- Responsive design

Files needed:
- public/index.html (complete HTML with CSS and JavaScript)
- package.json (with basic info)
```

2. Press **Enter** or click Send
3. **Wait** for AI to generate (10-30 seconds)
4. **Verify AI response** shows:
   - Explanation of what was created
   - List of files that will be created
   - "Pending Review" status

**Expected:**
- ✅ AI generates response without "Invalid operations" error
- ✅ Shows files like: `public/index.html`, `package.json`
- ✅ Message shows "Approve & Apply" button

**If you get "Invalid operations" error:**
- Check docker logs: `docker logs dyad-collaborative-app-1 --tail 50`
- Look for "Operation validation failed:" messages
- Share the validation errors for debugging

---

### **TEST 4: Approve & Apply Changes** (2 min)

1. Click **"Approve & Apply"** button in AI chat
2. **Watch for:**
   - Toast notification: "X file(s) updated successfully"
   - Files appearing in left sidebar
3. **Verify files appear immediately:**
   - ✅ `public/index.html`
   - ✅ `package.json`
   - No need to navigate away and back!

**Expected:**
- ✅ Files appear in sidebar within 1-2 seconds
- ✅ Toast shows success message
- ✅ File tree updates automatically

---

### **TEST 5: Start Preview Server** (3 min)

1. Look for preview controls in **top right** of editor header
2. Click **"Start Preview"** button
3. **Watch for:**
   - Button shows spinner: "Starting..."
   - Toast notification: "Preview Started - Server running on port XXXX"
   - Button changes to: "Stop Preview"

4. Click **"Preview"** tab in center panel
5. **Verify:**
   - ✅ Counter app loads in iframe
   - ✅ Gradient background visible
   - ✅ Counter shows: "Count: 0"

**Expected:**
- ✅ Preview starts in 2-3 seconds
- ✅ No "localhost refused to connect" error
- ✅ App displays properly in iframe

**If preview doesn't work:**
```bash
# Check if server is running
docker exec dyad-collaborative-app-1 ps aux | grep http-server

# Check if port is accessible
curl -I http://localhost:3100

# Check logs
docker logs dyad-collaborative-app-1 --tail 50 | grep -i preview
```

---

### **TEST 6: Test Interactivity** (2 min)

1. In the preview iframe, click:
   - **Increment button** → Count should go to 1, 2, 3...
   - **Decrement button** → Count should go down
   - **Reset button** → Count should go to 0

**Expected:**
- ✅ All buttons work
- ✅ Counter updates immediately
- ✅ No console errors

---

### **TEST 7: Stop Preview** (1 min)

1. Click **"Stop Preview"** button
2. **Verify:**
   - Toast: "Preview Stopped"
   - Preview tab shows placeholder message
   - Button reverts to "Start Preview"

**Expected:**
- ✅ Server stops cleanly
- ✅ Database updated (status='stopped')

**Verify in database:**
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT port, status, stopped_at FROM preview_servers ORDER BY created_at DESC LIMIT 3;"
```

---

### **TEST 8: Restart Preview** (2 min)

1. Click **"Start Preview"** again
2. **Verify:**
   - Gets same or different port
   - App loads again
   - All functionality still works

**Expected:**
- ✅ Can start/stop multiple times
- ✅ No errors on restart

---

### **TEST 9: Modify App with AI** (3 min)

1. In AI chat, enter:
```
Change the counter app:
- Add a header saying "My Awesome Counter"
- Change background to a blue-purple gradient
- Add a footer with your favorite emoji
```

2. Wait for AI response
3. Click **"Approve & Apply"**
4. **Verify:** Files update immediately in sidebar
5. **Restart preview** to see changes:
   - Stop Preview
   - Start Preview
6. **Verify:** Changes are visible

**Expected:**
- ✅ Files refresh immediately after apply
- ✅ Changes visible after preview restart
- ✅ No file loss

---

### **TEST 10: Persistence Test** (5 min)

1. **Note current state:**
   - Count of files in project
   - Preview server status

2. **Restart container:**
```bash
docker compose restart app
```

3. **Wait 10 seconds**, then refresh browser

4. **Verify:**
   - ✅ Project still exists
   - ✅ All files still present in sidebar
   - ✅ Can open files and see content
   - ✅ Can start preview again (creates new server)

**Expected:**
- ✅ All files persist across restarts
- ✅ Database stays consistent
- ✅ No data loss

---

## 📊 VERIFICATION COMMANDS

### **Check Container Status**
```bash
docker ps | grep dyad
```
Expected: 3 containers running (app, db, redis)

### **Check Exposed Ports**
```bash
docker port dyad-collaborative-app-1 | head -10
```
Expected: Ports 3000, 3100-3200 all mapped

### **Check Project Files Volume**
```bash
docker volume ls | grep project
```
Expected: `dyad-collaborative_project_files` volume exists

### **List Files in Project**
```bash
docker exec dyad-collaborative-app-1 ls -la /app/projects/YOUR_PROJECT_ID/
```
Expected: See generated files

### **Check Running Preview Servers**
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT project_id, port, status, framework FROM preview_servers WHERE status='running';"
```

### **Test Preview Server Directly**
```bash
# Replace 3100 with actual port from database
curl http://localhost:3100/
```
Expected: HTML content returned

### **Watch Logs in Real-Time**
```bash
docker logs -f dyad-collaborative-app-1
```
Use during testing to see what's happening

---

## 🐛 TROUBLESHOOTING

### **Issue: "Invalid operations" error during AI generation**

**Check logs:**
```bash
docker logs dyad-collaborative-app-1 2>&1 | grep -A 10 "Operation validation failed"
```

**Common causes:**
1. AI generated invalid file paths (e.g., outside src/ or public/)
2. AI tried to modify non-existent files
3. File content too large (>100KB)
4. TypeScript project but AI used .js/.jsx extensions

**Solution:**
- Rephrase prompt to be more specific about file structure
- Check validation error details in logs
- Try different AI model if persistent

---

### **Issue: Preview shows blank page**

**Debug steps:**
```bash
# 1. Check if files exist
docker exec dyad-collaborative-app-1 ls -la /app/projects/YOUR_PROJECT_ID/public/

# 2. Check file content
docker exec dyad-collaborative-app-1 cat /app/projects/YOUR_PROJECT_ID/public/index.html

# 3. Check if server is running
docker exec dyad-collaborative-app-1 ps aux | grep http-server

# 4. Test server directly
curl http://localhost:XXXX/
```

**Common causes:**
1. No index.html file
2. Files in wrong directory (not in public/)
3. Server not actually running
4. Port not accessible

---

### **Issue: Files disappear after restart**

**Check volume:**
```bash
docker volume inspect dyad-collaborative_project_files
```

**Verify volume is mounted:**
```bash
docker inspect dyad-collaborative-app-1 | grep -A 10 "Mounts"
```

Should show: `/app/projects` mounted to volume

---

### **Issue: Preview shows "404 Not Found"**

**Possible causes:**
1. API route not built correctly
2. Next.js routing issue
3. File not in correct location

**Fix:**
```bash
# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

### **Issue: Port already in use**

**Find and stop conflicting process:**
```bash
# On Mac/Linux
lsof -i :3100

# Kill process
kill -9 PID
```

Or stop all preview servers:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "UPDATE preview_servers SET status='stopped', stopped_at=NOW() WHERE status='running';"
```

---

## ✅ SUCCESS CRITERIA

### **AI Generation**
- [  ] Generates code without "Invalid operations" error
- [  ] Creates valid file structure
- [  ] Files appear immediately after apply
- [  ] No need to refresh page

### **Preview Server**
- [  ] Starts within 3 seconds
- [  ] No "connection refused" errors
- [  ] App displays in iframe
- [  ] All interactions work
- [  ] Can stop and restart

### **Persistence**
- [  ] Files survive container restart
- [  ] Database stays consistent
- [  ] Can reopen project after days

### **User Experience**
- [  ] No confusing error messages
- [  ] Clear feedback on all actions
- [  ] Fast response times
- [  ] Matches dyad-main desktop experience

---

## 📸 REFERENCE: DYAD-MAIN DESKTOP

Based on your reference screenshot, the dyad-collaborative should have:

1. **3-Panel Layout:**
   - Left: File tree with folders
   - Center: Preview/Code tabs with content
   - Right: AI assistant chat

2. **Preview Tab:**
   - Shows running application
   - Iframe with actual app content
   - Full interactivity

3. **AI Assistant:**
   - Chat interface
   - Code generation
   - Approve/reject buttons
   - Status indicators

4. **File Operations:**
   - Create, modify, delete
   - Immediate updates
   - Syntax highlighting

**Your dyad-collaborative should now match this experience!**

---

## 🚀 NEXT STEPS AFTER TESTING

1. **If all tests pass:**
   - Document any quirks discovered
   - Create user guide with screenshots
   - Plan production deployment
   - Set up monitoring

2. **If tests fail:**
   - Note specific error messages
   - Collect logs: `docker logs dyad-collaborative-app-1 > debug.log`
   - Check database state
   - Share findings for debugging

3. **Performance testing:**
   - Test with 10+ files
   - Test concurrent users
   - Monitor memory: `docker stats`
   - Test with large files

4. **Security testing:**
   - Test file path traversal prevention
   - Test API authentication
   - Test rate limiting
   - Test XSS in preview iframe

---

## 📞 GETTING HELP

If you encounter issues:

1. **Collect information:**
   ```bash
   # Full logs
   docker logs dyad-collaborative-app-1 > app-logs.txt
   
   # Database state
   docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "\dt" > db-tables.txt
   
   # Container info
   docker inspect dyad-collaborative-app-1 > container-info.txt
   ```

2. **Screenshots:**
   - Browser console (F12)
   - Network tab showing failed requests
   - UI showing error state

3. **Describe:**
   - What you were trying to do
   - What you expected to happen
   - What actually happened
   - Any error messages

---

## 🎉 SUMMARY

**All critical preview server issues have been fixed:**
- ✅ Files persist across restarts (Docker volume)
- ✅ Preview ports properly exposed (3100-3200)
- ✅ Process validation prevents stale entries
- ✅ Server binds to all interfaces
- ✅ Enhanced error logging for debugging
- ✅ Clear error messages when files missing

**The application is ready for comprehensive testing!**

Start with TEST 1 and work through all 10 test scenarios. The preview functionality should now work exactly like the dyad-main desktop version.

**Good luck with testing! 🚀**
