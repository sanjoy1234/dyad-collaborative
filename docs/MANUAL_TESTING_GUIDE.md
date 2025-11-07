# AI Code Generation System - Manual Testing Guide

## Overview
This guide walks through manual testing of the complete AI code generation workflow.

## Prerequisites
- Docker containers running (`docker-compose up`)
- Application accessible at http://localhost:3000
- Valid OpenAI API key configured in user settings

## Test Scenarios

### Test 1: Simple Component Generation

**Goal:** Generate a single React component

**Steps:**
1. Login to the application
2. Open or create a Next.js project
3. Navigate to the AI code generation interface
4. Enter prompt:
   ```
   Create a reusable Button component with TypeScript. 
   It should accept props for variant (primary, secondary, danger), 
   size (small, medium, large), disabled state, and onClick handler. 
   Use Tailwind CSS for styling.
   ```
5. Click "Generate"

**Expected Results:**
- ✓ Generation completes in 5-15 seconds
- ✓ Response includes:
  - `generationId` (UUID)
  - `operations` array with 1 create operation
  - `diffs` object showing file content with + lines
  - `snapshotId` (UUID for rollback)
  - `explanation` describing the component
- ✓ Operation shows:
  - `type: "create"`
  - `path: "src/components/Button.tsx"` (or similar)
  - `content` with valid TypeScript/React code
- ✓ Diff shows:
  - Green + lines for new code
  - Stats: `1 file changed, X insertions(+)`

### Test 2: View Generation Details

**Goal:** Retrieve and display generation before approval

**Steps:**
1. Copy the `generationId` from Test 1
2. Call: `GET /api/ai/generations/{generationId}`

**Expected Results:**
- ✓ Response includes:
  - `status: "pending"`
  - `filesCreated: ["src/components/Button.tsx"]`
  - `filesModified: []`
  - `filesDeleted: []`
  - `diffs` with detailed line-by-line changes
  - `snapshotBefore` (UUID)
  - `snapshotAfter: null`
  - `approvedBy: null`

### Test 3: Approve and Apply Changes

**Goal:** Apply generated code to project files

**Steps:**
1. Review the diff from Test 2
2. Click "Approve" or call: `POST /api/ai/generations/{generationId}/approve`
3. Wait for response

**Expected Results:**
- ✓ Response includes:
  - `success: true`
  - `filesChanged: ["src/components/Button.tsx"]`
  - `snapshotAfter` (UUID for new snapshot)
- ✓ File system verification:
  ```bash
  docker exec dyad-app ls -la /app/projects/{projectId}/src/components/Button.tsx
  docker exec dyad-app cat /app/projects/{projectId}/src/components/Button.tsx
  ```
  File should exist with exact generated content
- ✓ Generation status updated:
  - `status: "applied"`
  - `approvedBy: {userId}`
  - `approvedAt: {timestamp}`

### Test 4: Multi-File Generation

**Goal:** Generate multiple related files in one request

**Steps:**
1. Enter prompt:
   ```
   Create a TodoList component and a TodoItem component. 
   TodoList should manage state with useState and display a list of TodoItems. 
   TodoItem should show a checkbox, text, and delete button. 
   Use TypeScript interfaces for props.
   ```
2. Click "Generate"

**Expected Results:**
- ✓ Operations array contains 2 create operations:
  - `src/components/TodoList.tsx`
  - `src/components/TodoItem.tsx`
- ✓ Diffs show both files
- ✓ Stats: `2 files changed, X insertions(+)`
- ✓ TodoList imports and uses TodoItem
- ✓ TypeScript interfaces defined in both files

### Test 5: Modify Existing File

**Goal:** Update previously generated component

**Prerequisites:** Test 3 completed (Button.tsx exists)

**Steps:**
1. Enter prompt:
   ```
   Update the Button component to add a loading state with a spinner icon. 
   Add a 'loading' prop and disable the button when loading.
   ```
2. Click "Generate"

**Expected Results:**
- ✓ Operations array contains 1 modify operation:
  - `type: "modify"`
  - `path: "src/components/Button.tsx"`
- ✓ Diff shows:
  - Red - lines (removed code)
  - Green + lines (added code)
  - Context lines (unchanged)
- ✓ Stats: `1 file changed, X insertions(+), Y deletions(-)`
- ✓ After approval, file content updated correctly

### Test 6: Rejection Workflow

**Goal:** Reject unwanted changes without applying

**Steps:**
1. Generate any code (use Test 1 prompt again)
2. Review the diff
3. Click "Reject" or call: `POST /api/ai/generations/{generationId}/reject`

**Expected Results:**
- ✓ Response: `{ success: true }`
- ✓ Generation status: `"rejected"`
- ✓ Files NOT changed in file system
- ✓ `snapshotAfter` remains `null`
- ✓ Cannot approve after rejection (should return error)

### Test 7: Framework Detection

**Goal:** Verify AI uses framework-specific best practices

**Steps:**
1. Check project's `package.json` contains `"next": "14.x"`
2. Generate a page component:
   ```
   Create an About page for the Next.js app with metadata
   ```
3. Review generated code

**Expected Results:**
- ✓ Code uses App Router conventions: `src/app/about/page.tsx`
- ✓ Includes metadata export:
   ```typescript
   export const metadata = {
     title: 'About',
     description: '...'
   };
   ```
- ✓ Uses `next/link` for navigation
- ✓ Uses `next/image` for images (if applicable)
- ✓ Explanation mentions "Next.js App Router"

### Test 8: Snapshot and Rollback

**Goal:** Restore project to previous state

**Prerequisites:** Tests 3 and 5 completed (files created and modified)

**Steps:**
1. Get `snapshotBefore` ID from Test 3 (before Button.tsx was created)
2. Call: `POST /api/snapshots/{snapshotId}/restore`
3. Verify file system

**Expected Results:**
- ✓ Button.tsx removed from file system
- ✓ Project restored to exact state before generation
- ✓ New snapshot created as backup before restore
- ✓ All files match snapshot content

### Test 9: Security - Path Traversal

**Goal:** Ensure path traversal attacks are prevented

**Steps:**
1. Attempt to generate file outside project:
   ```
   Create a file at ../../../etc/passwd
   ```
2. Submit generation request

**Expected Results:**
- ✓ Either:
  - AI refuses and returns error in explanation
  - OR validation rejects operations:
    ```json
    { "error": "Invalid operation: path traversal detected" }
    ```
- ✓ No files created outside project directory
- ✓ Generation status: `"error"` or never created

### Test 10: Large File Handling

**Goal:** Test behavior with large code files

**Steps:**
1. Generate complex component:
   ```
   Create a DataTable component with sorting, filtering, pagination, 
   row selection, column resizing, and export to CSV. Include all TypeScript 
   types and comprehensive documentation.
   ```
2. Review response

**Expected Results:**
- ✓ Generation completes (may take 20-30 seconds)
- ✓ File size reasonable (<100KB per validation)
- ✓ Code quality maintained despite size
- ✓ Diff readable with proper hunks

### Test 11: Atomic Rollback

**Goal:** Verify transaction rollback on errors

**Steps:**
1. Manually corrupt a project file:
   ```bash
   docker exec dyad-app chmod 000 /app/projects/{projectId}/src/app/page.tsx
   ```
2. Generate modification to page.tsx and another file
3. Approve generation

**Expected Results:**
- ✓ Response: `{ success: false, error: "Permission denied", rollbackPerformed: true }`
- ✓ No partial changes applied
- ✓ All files in original state
- ✓ Generation status: `"rejected"` or `"error"`

## API Testing with cURL

### Generate Code
```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "prompt": "Create a Button component",
    "model": "gpt-4o"
  }'
```

### Get Generation Details
```bash
curl -X GET http://localhost:3000/api/ai/generations/{generationId} \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Approve Generation
```bash
curl -X POST http://localhost:3000/api/ai/generations/{generationId}/approve \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Reject Generation
```bash
curl -X POST http://localhost:3000/api/ai/generations/{generationId}/reject \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

## Verification Commands

### Check Generated Files
```bash
# List project files
docker exec dyad-app find /app/projects/{projectId} -type f -name "*.tsx"

# View file content
docker exec dyad-app cat /app/projects/{projectId}/src/components/Button.tsx

# Check file permissions
docker exec dyad-app ls -la /app/projects/{projectId}/src/components/
```

### Check Database Records
```bash
# Connect to PostgreSQL
docker exec -it dyad-db psql -U dyad -d dyad

# View generations
SELECT id, status, files_created, files_modified, approved_at 
FROM ai_generations 
ORDER BY created_at DESC 
LIMIT 5;

# View snapshots
SELECT id, project_id, description, created_at 
FROM project_snapshots 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Logs
```bash
# Application logs
docker logs dyad-app --tail=100 -f

# Search for errors
docker logs dyad-app 2>&1 | grep -i error
```

## Success Criteria

All tests must pass with:
- ✓ No TypeScript compilation errors
- ✓ No runtime errors in Docker logs
- ✓ Files created with correct content and permissions
- ✓ Database records accurate and consistent
- ✓ Diffs display correctly with proper stats
- ✓ Rollback restores exact previous state
- ✓ Security validations prevent malicious operations
- ✓ Atomic operations ensure no partial failures

## Troubleshooting

### Generation Fails with 401 Unauthorized
- Check API key configured in user settings
- Verify model name is correct (`gpt-4o`, `claude-3-5-sonnet-20241022`, etc.)

### Files Not Created After Approval
- Check Docker container logs: `docker logs dyad-app`
- Verify project path: `docker exec dyad-app ls -la /app/projects/{projectId}`
- Check file permissions

### Diff Not Showing
- Verify metadata in database: `SELECT metadata FROM ai_generations WHERE id = '...'`
- Check diff-generator logs for errors

### Snapshot Restore Fails
- Verify snapshot exists: `SELECT * FROM project_snapshots WHERE id = '...'`
- Check snapshot_data is valid JSONB
- Ensure user has permissions

## Next Steps After Testing

Once all manual tests pass:
1. Run automated test script: `./scripts/test-code-generation.sh`
2. Document any edge cases discovered
3. Create UI components for code generation interface
4. Implement real-time streaming for generation progress
5. Add generation history view
