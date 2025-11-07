# 🧪 Dyad Collaborative - Testing Steps

## ✅ App Status
- **Status**: ✅ Running
- **URL**: http://localhost:3000
- **Build Time**: ~30 seconds
- **Startup Time**: ~38ms
- **Containers**: app (Next.js), db (PostgreSQL), redis

---

## 🎯 Test Scenario 1: File Refresh After Code Generation

### Objective
Verify that the file tree updates immediately after approving AI-generated code, without requiring page navigation.

### Steps

1. **Login to Dyad Collaborative**
   - Open browser: http://localhost:3000
   - Login with your credentials
   - Should redirect to projects dashboard

2. **Open or Create Test Project**
   - Navigate to an existing project (e.g., "test4")
   - OR create a new project: "File Refresh Test"
   
3. **Generate Code with AI**
   - In the editor, open the AI chat panel (right side)
   - Enter prompt: 
     ```
     Create a simple React button component in src/components/Button.tsx
     ```
   - Wait for AI to generate the code
   - Review the generated files in the chat

4. **Approve and Apply**
   - Click **"Approve & Apply"** button
   - Wait for success message: "X file(s) updated successfully"

5. **✅ VERIFY: Immediate File Tree Refresh**
   - **Expected**: Left sidebar file tree updates immediately
   - **Expected**: New file `src/components/Button.tsx` appears instantly
   - **NOT Expected**: Having to navigate away and back to see files
   
6. **Check Database (Optional)**
   ```bash
   docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT path, created_at FROM project_files ORDER BY created_at DESC LIMIT 5;"
   ```
   - Verify the new file is in the database

### ✅ Success Criteria
- [ ] Files appear in sidebar within 1 second of approval
- [ ] No page refresh or navigation required
- [ ] Toast notification shows "Files Refreshed"
- [ ] File is clickable and displays content

---

## 🎯 Test Scenario 2: Preview Server for React Apps

### Objective
Verify that generated React applications can be previewed and run within Dyad Collaborative using the built-in preview server.

### Steps

1. **Generate a React Application**
   - In a project, use AI chat to generate:
     ```
     Create a simple React counter app with:
     - A display showing the current count
     - Increment button (+1)
     - Decrement button (-1)
     - Reset button (set to 0)
     - Add some nice Tailwind CSS styling
     
     Create the following files:
     - src/App.tsx (main component)
     - src/components/Counter.tsx (counter logic)
     - public/index.html (entry point)
     - package.json (with react, react-dom dependencies)
     ```
   
2. **Approve the Generated Files**
   - Click **"Approve & Apply"**
   - Verify files appear in sidebar immediately
   
3. **Start Preview Server**
   - Look for the preview controls in the header area
   - Click **"Start Preview"** button
   - **Expected**: Button shows loading spinner with text "Starting..."
   - **Expected**: Toast notification: "Preview Started - Server running on port XXXX"
   - **Expected**: Button changes to **"Stop Preview"**
   
4. **✅ VERIFY: Preview Tab Shows Running App**
   - Click on the **"Preview"** tab in center panel
   - **Expected**: See iframe with your running counter app
   - **Expected**: App is fully interactive:
     - Click increment (+1) - count increases
     - Click decrement (-1) - count decreases
     - Click reset - count goes to 0
   - **Expected**: Styling is applied correctly

5. **Check Preview Server Status**
   ```bash
   docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT project_id, port, status, framework, started_at FROM preview_servers WHERE status='running';"
   ```
   - Verify server entry exists with status='running'
   - Note the port number (should be 3100-3200 range)

6. **Test Preview Server Directly (Optional)**
   ```bash
   curl http://localhost:XXXX  # Use the port from database
   ```
   - Should return HTML content of the app

7. **Stop Preview Server**
   - Click **"Stop Preview"** button
   - **Expected**: Preview tab shows placeholder message
   - **Expected**: Toast notification: "Preview Stopped"
   - **Expected**: Button changes back to "Start Preview"

8. **Verify Server Stopped**
   ```bash
   docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT project_id, port, status, stopped_at FROM preview_servers ORDER BY created_at DESC LIMIT 1;"
   ```
   - Verify status changed to 'stopped'
   - Verify stopped_at timestamp is set

### ✅ Success Criteria
- [ ] Preview server starts within 3-5 seconds
- [ ] Port is allocated in 3100-3200 range
- [ ] Framework is detected correctly (should show 'react')
- [ ] App displays in iframe without errors
- [ ] App is fully interactive (buttons work)
- [ ] Preview server stops cleanly
- [ ] Database reflects correct status

---

## 🎯 Test Scenario 3: End-to-End Workflow

### Objective
Test the complete workflow from project creation to preview, including modifications.

### Steps

1. **Create New Project**
   - Click "New Project"
   - Name: "E2E Preview Test"
   - Description: "Testing complete workflow"
   - Click "Create"

2. **Generate Initial App**
   - Open AI chat
   - Prompt:
     ```
     Create a todo list app with:
     - Add todo input and button
     - List of todos with delete button
     - Mark as complete (strikethrough)
     - Use Tailwind CSS
     
     Files needed:
     - src/App.tsx
     - src/components/TodoList.tsx
     - src/components/TodoItem.tsx
     - public/index.html
     - package.json
     ```
   - Click "Approve & Apply"

3. **✅ VERIFY: Files Refresh**
   - Confirm all files appear immediately in sidebar

4. **Start Preview**
   - Click "Start Preview"
   - Switch to Preview tab
   - **Test the app**:
     - Add a todo: "Buy milk"
     - Add another: "Walk dog"
     - Mark "Buy milk" as complete
     - Delete "Walk dog"

5. **Modify the App**
   - Go back to AI chat
   - Prompt:
     ```
     Add a header to the todo app that says "My Todo List" with a gradient background
     ```
   - Click "Approve & Apply"

6. **✅ VERIFY: Files Refresh Again**
   - Confirm modified files appear immediately

7. **Restart Preview to See Changes**
   - Click "Stop Preview"
   - Click "Start Preview"
   - **Verify**: New header appears with gradient

8. **Test Multiple Framework Detection**
   - Create a new project
   - Generate a static HTML page:
     ```
     Create a simple landing page with:
     - index.html with hero section
     - styles.css with animations
     - script.js with scroll effects
     ```
   - Approve and Start Preview
   - **Verify**: Framework detected as 'static'
   - **Verify**: Page renders correctly

### ✅ Success Criteria
- [ ] Complete workflow works without errors
- [ ] File refresh works at every step
- [ ] Preview updates when restarted
- [ ] Different frameworks detected correctly
- [ ] No manual page refresh needed anywhere

---

## 🎯 Test Scenario 4: Multi-User Collaboration (If Applicable)

### Steps

1. **User 1: Start Preview**
   - Generate an app
   - Start preview server
   - Note the port number

2. **User 2: Open Same Project**
   - Login as different user (if collaborator)
   - Open the same project
   - **Verify**: See same files

3. **User 2: Check Preview Status**
   - Click Preview tab
   - **Expected**: Either see message that preview is not started, or API should check if server is already running for this project

4. **Database Check**
   ```bash
   docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT COUNT(*) as active_previews FROM preview_servers WHERE status='running';"
   ```

### ✅ Success Criteria
- [ ] Only one preview server per project
- [ ] Port conflicts are avoided
- [ ] Preview state is tracked correctly

---

## 🐛 Troubleshooting

### Issue: Files Not Refreshing
**Check:**
```bash
# Verify API endpoint exists
curl http://localhost:3000/api/projects/YOUR_PROJECT_ID/files

# Check database
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT id, path FROM project_files WHERE project_id='YOUR_PROJECT_ID';"
```

### Issue: Preview Not Starting
**Check:**
```bash
# Check app logs
docker logs dyad-collaborative-app-1 --tail 50

# Check available ports
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT port, status FROM preview_servers WHERE status='running';"

# Verify http-server is available
docker exec dyad-collaborative-app-1 which http-server
```

**Fix:**
```bash
# Install http-server if missing
docker exec dyad-collaborative-app-1 npm install -g http-server

# Or rebuild container
docker compose down
docker compose up -d --build
```

### Issue: Preview Shows Blank Page
**Check:**
```bash
# Check if files exist in container
docker exec dyad-collaborative-app-1 ls -la /app/projects/YOUR_PROJECT_ID/

# Check preview server logs
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT logs, error FROM preview_servers ORDER BY created_at DESC LIMIT 1;"
```

### Issue: Port Already in Use
**Fix:**
```bash
# Stop all running preview servers
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "UPDATE preview_servers SET status='stopped', stopped_at=NOW() WHERE status='running';"

# Or use API to stop
curl -X DELETE http://localhost:3000/api/projects/YOUR_PROJECT_ID/preview/start
```

---

## 📊 Database Verification Commands

```bash
# Check all project files
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT project_id, path, size, created_at FROM project_files ORDER BY created_at DESC LIMIT 10;"

# Check preview servers
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT project_id, port, status, framework, process_id, started_at FROM preview_servers ORDER BY created_at DESC LIMIT 5;"

# Check for running servers
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT COUNT(*) FROM preview_servers WHERE status='running';"

# Check port allocation
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT port, COUNT(*) FROM preview_servers WHERE status='running' GROUP BY port;"
```

---

## 🎬 Quick Test Commands

```bash
# 1. Rebuild and start
cd /Users/sanjoy.ghoshapexon.com/Library/CloudStorage/OneDrive-Apexon/demoworkspace/dyad-collaborative
docker compose down
docker compose up -d --build

# 2. Check app status
docker logs dyad-collaborative-app-1 --tail 10

# 3. Test app is responding
curl -I http://localhost:3000

# 4. Watch logs in real-time (during testing)
docker logs -f dyad-collaborative-app-1

# 5. Check all containers
docker compose ps
```

---

## ✅ Final Checklist

### Before Testing
- [ ] All containers running (app, db, redis)
- [ ] App shows "Ready" in logs
- [ ] Can access http://localhost:3000
- [ ] Database is accessible

### After Testing
- [ ] File refresh works ✅
- [ ] Preview server starts ✅
- [ ] Preview shows app in iframe ✅
- [ ] Preview server stops ✅
- [ ] Framework detection works ✅
- [ ] No console errors
- [ ] Database entries are correct

---

## 📝 Test Results Template

```
Date: _____________
Tester: _____________

Test Scenario 1: File Refresh
- Files appear immediately: [ ] PASS [ ] FAIL
- No navigation required: [ ] PASS [ ] FAIL
- Toast notification shown: [ ] PASS [ ] FAIL
Notes: _________________________________

Test Scenario 2: Preview Server
- Server starts successfully: [ ] PASS [ ] FAIL
- App displays in iframe: [ ] PASS [ ] FAIL
- App is interactive: [ ] PASS [ ] FAIL
- Server stops successfully: [ ] PASS [ ] FAIL
Notes: _________________________________

Test Scenario 3: End-to-End
- Complete workflow works: [ ] PASS [ ] FAIL
- Modifications work: [ ] PASS [ ] FAIL
- Framework detection works: [ ] PASS [ ] FAIL
Notes: _________________________________

Overall Status: [ ] APPROVED [ ] NEEDS FIXES
```

---

## 🚀 Next Steps After Testing

1. If all tests pass:
   - Document any edge cases found
   - Create user guide with screenshots
   - Plan for production deployment

2. If tests fail:
   - Note specific error messages
   - Collect logs: `docker logs dyad-collaborative-app-1 > debug.log`
   - Share results for debugging

3. Performance testing:
   - Test with large projects (100+ files)
   - Test multiple concurrent preview servers
   - Monitor memory usage: `docker stats`
