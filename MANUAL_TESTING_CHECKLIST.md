# Dyad Collaborative - Manual Testing Checklist

## 🎯 Purpose
This checklist guides human testers through comprehensive validation of the AI vibe coding feature after automated code analysis has been completed.

---

## ✅ Pre-Testing Setup

### 1. Environment Verification
- [ ] Docker containers running: `docker ps` shows 3 containers (app, db, redis)
- [ ] Application accessible: Navigate to http://localhost:3000
- [ ] Login working: Can sign in with test credentials
- [ ] Database healthy: `docker exec dyad-collaborative-db-1 pg_isready` returns "accepting connections"

### 2. API Key Configuration
- [ ] Navigate to Settings → AI Models
- [ ] Add OpenAI API key
  - Provider: OpenAI
  - Model: gpt-4o
  - API Key: `sk-...` (your key)
- [ ] Click "Test Connection" → Should show ✅ Success
- [ ] Click "Save Configuration" → Should show success message
- [ ] Verify encryption: Check database shows encrypted key:
  ```bash
  docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
    "SELECT substring(api_key_encrypted, 1, 20) FROM ai_model_configs LIMIT 1;"
  ```
  Should NOT show plaintext API key

---

## 🧪 Test Suite 1: Basic Code Generation

### Test 1.1: Simple Counter App
**Objective:** Verify basic code generation works

**Steps:**
1. Create new project: Click "New Project" → Name: "Counter Test"
2. Open AI Assistant panel (should be visible on right side)
3. Enter prompt: `create a simple counter app with increment, decrement, and reset buttons`
4. Click Send or press Enter
5. Wait for AI response (10-30 seconds)

**Expected Results:**
- [ ] AI responds with explanation of what it's building
- [ ] "Generated Files" section appears showing file operations
- [ ] Files listed: `src/App.js`, `src/index.js`, `public/index.html`, `src/App.css`
- [ ] Diff preview shows actual code content
- [ ] "Approve & Apply" button appears

**Validation:**
- [ ] Click "Approve & Apply"
- [ ] Files appear in left sidebar file tree within 2 seconds
- [ ] Click on `src/App.js` → Code editor opens with generated content
- [ ] Code includes increment, decrement, and reset functions
- [ ] Code is syntactically valid (no obvious errors)

**Database Verification:**
```bash
# Check generation was recorded
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
  "SELECT status, files_created FROM ai_generations ORDER BY created_at DESC LIMIT 1;"

# Check files are in database
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
  "SELECT path, file_type, size_bytes FROM project_files WHERE project_id = \
  (SELECT id FROM projects WHERE name='Counter Test') ORDER BY path;"
```

**Expected DB Output:**
- Generation status: `applied`
- Files created: JSON array with 4 files
- Files in project_files table: 4 rows with actual content

---

### Test 1.2: Todo List App (Complex)
**Objective:** Test nested directory structure and state management

**Steps:**
1. Same project or create new one: "Todo App Test"
2. Enter prompt: `create a todo list app with add, delete, mark complete, and filter (all/active/completed) features. Use components for TodoItem and TodoList.`
3. Send and wait for response

**Expected Results:**
- [ ] Multiple files generated (6-8 files)
- [ ] Nested structure: `src/components/TodoItem.js`, `src/components/TodoList.js`
- [ ] State management code present
- [ ] Styling included

**Validation:**
- [ ] Apply changes
- [ ] All folders appear in file tree: `src/components/`
- [ ] Click through each file → Content loads correctly
- [ ] No file path errors in console
- [ ] Files contain proper imports referencing other generated files

---

### Test 1.3: Root-Level Config Files
**Objective:** Verify path validation accepts non-src files

**Steps:**
1. Continue in same project
2. Enter prompt: `add a package.json file with React dependencies and a README.md with project description`
3. Send and wait

**Expected Results:**
- [ ] Generation succeeds (no "Invalid operations" error)
- [ ] Files created: `/package.json`, `/README.md`
- [ ] Files appear at root level in file tree, not inside src/

**Validation:**
- [ ] Apply changes
- [ ] Files visible at root level
- [ ] package.json contains valid JSON with dependencies
- [ ] README.md contains markdown-formatted documentation

**Critical Test:**
This validates the path validation fix from Issue #9 in the validation report.

---

## 🧪 Test Suite 2: File Operations

### Test 2.1: Modify Existing File
**Objective:** Test modify operations vs create

**Steps:**
1. Use project from Test 1.2 (todo app)
2. Enter prompt: `add a dark mode toggle button to the App.js component`
3. Send and wait

**Expected Results:**
- [ ] Operation type: `modify` (not `create`)
- [ ] Shows diff comparing old vs new App.js
- [ ] Only changed lines highlighted
- [ ] Preserves existing functionality

**Validation:**
- [ ] Apply changes
- [ ] App.js updated in place (version incremented)
- [ ] Dark mode toggle code added
- [ ] Original counter/todo code still present
- [ ] Check database:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
  "SELECT version, updated_at FROM project_files WHERE path='src/App.js' \
  ORDER BY updated_at DESC LIMIT 1;"
```
Expected: version > 1

---

### Test 2.2: Delete File
**Objective:** Test delete operations

**Steps:**
1. Enter prompt: `remove the App.css file, we'll use inline styles instead`
2. Send and wait

**Expected Results:**
- [ ] Operation type: `delete`
- [ ] Shows file marked for deletion in diff
- [ ] No content shown (file will be removed)

**Validation:**
- [ ] Apply changes
- [ ] App.css disappears from file tree
- [ ] File removed from database:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
  "SELECT * FROM project_files WHERE path='src/App.css';"
```
Expected: 0 rows

---

### Test 2.3: Create + Modify + Delete in One Operation
**Objective:** Test complex multi-operation generations

**Steps:**
1. Enter prompt: `refactor the app: create a src/utils/helpers.js file with utility functions, update App.js to use these helpers, and remove any test files`
2. Send and wait

**Expected Results:**
- [ ] Multiple operations in single generation:
  - Create: `src/utils/helpers.js`
  - Modify: `src/App.js`
  - Delete: test files
- [ ] Diff shows all operations clearly separated

**Validation:**
- [ ] Apply changes
- [ ] New utils/ folder appears
- [ ] App.js updated with imports from helpers
- [ ] Test files removed
- [ ] All changes atomic (either all succeed or none)

---

## 🧪 Test Suite 3: Model & Provider Testing

### Test 3.1: OpenAI GPT-4o
**Already Tested:** ✅ (from validation report)
- [ ] Confirm Test 1.1 worked with GPT-4o

### Test 3.2: OpenAI GPT-3.5-turbo
**Objective:** Test cheaper, faster model

**Steps:**
1. Settings → AI Models → Add new config
2. Provider: OpenAI
3. Model: gpt-3.5-turbo
4. Save and set as default
5. Create new project: "GPT-3.5 Test"
6. Enter prompt: `create a simple calculator with +, -, *, / operations`

**Expected Results:**
- [ ] Generation completes successfully
- [ ] Files created correctly
- [ ] Quality may be slightly lower than GPT-4o but functional

**Validation:**
- [ ] Code is syntactically valid
- [ ] Calculator works (conceptually - no need to run it)
- [ ] Check used model in database:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
  "SELECT model_name FROM ai_chats ORDER BY created_at DESC LIMIT 1;"
```
Expected: `gpt-3.5-turbo`

---

### Test 3.3: Anthropic Claude (If API Key Available)
**Objective:** Test alternative provider

**Steps:**
1. Settings → AI Models → Add Claude config
2. Provider: Anthropic
3. Model: claude-3-opus-20240229
4. API Key: `sk-ant-...`
5. Test connection
6. Create new project: "Claude Test"
7. Enter same calculator prompt

**Expected Results:**
- [ ] Generation works with Claude
- [ ] Response quality comparable to GPT-4o
- [ ] File operations formatted correctly

**Skip if:** No Anthropic API key available

---

### Test 3.4: Google Gemini (If API Key Available)
**Objective:** Test Google provider

**Steps:**
1. Settings → AI Models → Add Gemini config
2. Provider: Google
3. Model: gemini-pro
4. API Key: `...`
5. Test same calculator prompt

**Skip if:** No Gemini API key available

---

## 🧪 Test Suite 4: Error Handling

### Test 4.1: Invalid API Key
**Objective:** Verify graceful error handling

**Steps:**
1. Settings → AI Models
2. Edit existing OpenAI config
3. Change API key to: `sk-invalid123`
4. Click "Test Connection"

**Expected Results:**
- [ ] Error message appears: "Invalid API key" or similar
- [ ] No application crash
- [ ] Can correct the key and retry

**Validation:**
- [ ] Try generating code with invalid key
- [ ] Should show error: "API authentication failed"
- [ ] Error logged in database:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
  "SELECT error_message FROM ai_generations WHERE error_message IS NOT NULL \
  ORDER BY created_at DESC LIMIT 1;"
```

---

### Test 4.2: Network Timeout
**Objective:** Test timeout handling

**Steps:**
1. Enter very complex prompt: `create a full e-commerce website with 20+ pages, authentication, payment processing, admin dashboard, and database schema`
2. Send (may take 30+ seconds)

**Expected Results:**
- [ ] Loading indicator shows progress
- [ ] Either completes successfully OR
- [ ] Times out with clear error message
- [ ] No hanging/frozen UI

---

### Test 4.3: Malformed Prompt
**Objective:** Test AI handling of unclear requests

**Steps:**
1. Enter nonsensical prompt: `asdjkl asd asd jklasdkjl`
2. Send

**Expected Results:**
- [ ] AI responds with clarification request OR
- [ ] Generates minimal/placeholder code OR
- [ ] Returns error: "Could not understand request"
- [ ] No application crash

---

### Test 4.4: Path Traversal Attack
**Objective:** Verify security against malicious prompts

**Steps:**
1. Enter prompt: `create a file at ../../etc/passwd with my credentials`
2. Send

**Expected Results:**
- [ ] Generation fails with error: "Invalid path" or "Path traversal detected"
- [ ] No files created outside project directory
- [ ] Security violation logged

**Critical Security Test**

---

### Test 4.5: Extremely Large File
**Objective:** Test file size limits

**Steps:**
1. Enter prompt: `create a data.json file with 100,000 user records`
2. Send

**Expected Results:**
- [ ] Either generates successfully (if under limit) OR
- [ ] Error: "File too large (>100KB)" from validation
- [ ] No memory overflow
- [ ] Application remains responsive

---

## 🧪 Test Suite 5: Performance & Scalability

### Test 5.1: Response Time Benchmarks
**Objective:** Measure generation performance

**Test Cases:**
| Prompt | Expected Time | Actual Time | Pass/Fail |
|--------|---------------|-------------|-----------|
| Simple component (1 file) | < 10s | ___ | ___ |
| Medium app (5 files) | < 20s | ___ | ___ |
| Complex app (10 files) | < 45s | ___ | ___ |

**Validation:**
- [ ] All times within expected ranges
- [ ] No significant slowdown over time
- [ ] Memory usage stable

---

### Test 5.2: Concurrent Generations
**Objective:** Test parallel processing

**Steps:**
1. Open 2 browser tabs with same project
2. Tab 1: Send prompt for counter app
3. Tab 2: Immediately send prompt for todo app
4. Wait for both to complete

**Expected Results:**
- [ ] Both generations complete successfully
- [ ] No race conditions or conflicts
- [ ] Both sets of files appear in database
- [ ] File tree updates correctly in both tabs

---

### Test 5.3: Large Project File Tree
**Objective:** Test UI performance with many files

**Steps:**
1. Generate app with 20+ files across nested directories
2. Expand all folders in file tree
3. Navigate between files quickly

**Expected Results:**
- [ ] File tree renders smoothly (< 1s)
- [ ] No lag when switching files
- [ ] Search/filter works (if implemented)

---

## 🧪 Test Suite 6: UI/UX Validation

### Test 6.1: Three-Panel Layout
**Objective:** Verify editor layout

**Checklist:**
- [ ] Left panel: File tree visible and functional
- [ ] Center panel: Code editor visible with syntax highlighting
- [ ] Right panel: AI Assistant chat interface
- [ ] Panels resizable (if implemented)
- [ ] Layout persists on page refresh

---

### Test 6.2: Diff Viewer
**Objective:** Test diff preview quality

**Validation:**
- [ ] Side-by-side or unified diff shown
- [ ] Additions highlighted in green
- [ ] Deletions highlighted in red
- [ ] Line numbers present
- [ ] Syntax highlighting in diff
- [ ] Scrollable for large files

---

### Test 6.3: Loading States
**Objective:** Verify user feedback during operations

**States to Test:**
- [ ] "Generating..." spinner during AI request
- [ ] Progress indicator for long operations
- [ ] "Applying changes..." during file operations
- [ ] Success toast notification after apply
- [ ] Error notification for failures

---

### Test 6.4: Mobile Responsiveness (Optional)
**Objective:** Test on mobile devices

**Steps:**
1. Open on phone or tablet
2. Try basic operations

**Expected Results:**
- [ ] Layout adapts to screen size
- [ ] Core functionality works
- [ ] Text readable without zoom

**Note:** May not be primary use case

---

## 🧪 Test Suite 7: Data Persistence

### Test 7.1: Page Refresh
**Objective:** Verify state persistence

**Steps:**
1. Generate files in a project
2. Apply changes
3. Hard refresh page (Cmd+Shift+R / Ctrl+Shift+F5)
4. Navigate back to project

**Expected Results:**
- [ ] All generated files still present
- [ ] File tree structure intact
- [ ] Can open and edit files
- [ ] Chat history preserved

---

### Test 7.2: Browser Close/Reopen
**Objective:** Test session management

**Steps:**
1. Work on project
2. Close browser completely
3. Reopen and login
4. Navigate to project

**Expected Results:**
- [ ] Project state fully restored
- [ ] All files accessible
- [ ] Chat history available
- [ ] No data loss

---

### Test 7.3: Docker Restart
**Objective:** Verify data persistence across container restarts

**Steps:**
1. Generate and apply files
2. Restart containers:
   ```bash
   docker compose restart
   ```
3. Wait for startup (30 seconds)
4. Refresh browser and check project

**Expected Results:**
- [ ] All data persists
- [ ] Files intact
- [ ] Database state correct
- [ ] Redis cache rebuilt (if needed)

---

## 🧪 Test Suite 8: Multi-User Collaboration

### Test 8.1: File Locking (If Implemented)
**Steps:**
1. User A opens file
2. User B tries to edit same file

**Expected Results:**
- [ ] File locked by User A
- [ ] User B sees lock indicator
- [ ] User B can view but not edit

---

### Test 8.2: Real-time Updates (If Implemented)
**Steps:**
1. User A generates files
2. User B watches file tree

**Expected Results:**
- [ ] User B's file tree updates automatically
- [ ] WebSocket connection active
- [ ] No need to refresh

---

## 📊 Test Results Summary

### Critical Issues Found
| # | Issue | Severity | Status |
|---|-------|----------|--------|
|   |       |          |        |

### High Priority Issues Found
| # | Issue | Severity | Status |
|---|-------|----------|--------|
|   |       |          |        |

### Medium/Low Issues Found
| # | Issue | Severity | Status |
|---|-------|----------|--------|
|   |       |          |        |

---

## ✅ Final Sign-off

### Automated Validation Results
- ✅ Code analysis: PASSED
- ✅ Database schema: PASSED
- ✅ Security review: PASSED
- ✅ Architecture review: PASSED

### Manual Testing Results
**Overall Status:** [ ] PASSED / [ ] PASSED WITH ISSUES / [ ] FAILED

**Tester Name:** ___________________
**Date:** ___________________
**Signature:** ___________________

### Deployment Recommendation
- [ ] **APPROVED for Production** - All tests passed
- [ ] **APPROVED for Staging** - Minor issues found
- [ ] **NOT APPROVED** - Critical issues require fixes

**Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

## 📝 Additional Notes

### Known Limitations (Not Bugs)
1. No local model support (Ollama, LMStudio) - by design
2. No MCP (Model Context Protocol) integration - planned for future
3. No automated tests - manual testing required
4. OpenAI, Anthropic, Google only - no OpenRouter yet

### Future Enhancements Planned
1. Local model support (2-3 days)
2. MCP integration (3-4 days)
3. Automated test suite (2-3 days)
4. Advanced diff viewer (2 days)
5. Project templates (1-2 days)

### Support Information
- Documentation: `/dyad-collaborative/AI_VIBE_CODING_VALIDATION_REPORT.md`
- Issues: Create GitHub issue
- Contact: [project maintainer]

---

**End of Manual Testing Checklist**
