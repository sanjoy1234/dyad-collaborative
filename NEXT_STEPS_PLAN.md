# 🎯 Dyad Web Platform - Next Steps Implementation Plan

**Last Updated**: Session after foundation completion
**Current Status**: 40% Complete - Foundation & Infrastructure Ready
**Goal**: Complete remaining 60% to achieve 100% Dyad feature parity

---

## ✅ FOUNDATION COMPLETE (Phase 1-2: 40%)

### What's Working Now
- ✅ **Database**: 6 AI tables migrated and ready
- ✅ **AI Services**: OpenAI, Anthropic, Google Gemini integrated
- ✅ **Encryption**: AES-256-GCM for API keys
- ✅ **APIs**: Model config, test, and listing endpoints
- ✅ **Docker**: All services running (app, db, redis)
- ✅ **Authentication**: NextAuth working with redirects

### What You Can Test Right Now
1. **App Access**: http://localhost:3000 → Redirects to login ✅
2. **Database**: All AI tables exist (check via psql or database client)
3. **Docker Health**: `docker-compose ps` shows all services UP

---

## 📋 PHASE 3: AI CHAT SYSTEM (15% - Next 2 Days)

### Goal
Enable users to chat with AI models (GPT-4, Claude, Gemini) and receive streaming responses.

### Tasks

#### 1. Create AI Chat Backend APIs
**Files to Create:**
- `/src/app/api/ai/chat/route.ts` (200 lines)
  - POST: Streaming chat completion
  - Uses Server-Sent Events (SSE)
  - Supports all 3 providers
  - Streams token-by-token responses

- `/src/app/api/projects/[projectId]/chats/route.ts` (150 lines)
  - GET: List all chats for project
  - POST: Create new chat thread
  - Include message counts and last activity

- `/src/app/api/projects/[projectId]/chats/[chatId]/messages/route.ts` (180 lines)
  - GET: Retrieve chat history (paginated)
  - POST: Send message and get streaming response
  - Save messages to database

- `/src/app/api/projects/[projectId]/chats/[chatId]/route.ts` (100 lines)
  - GET: Get chat details
  - PATCH: Update chat title
  - DELETE: Delete chat and all messages

**Testing Checklist:**
```bash
# Test 1: Create a chat
curl -X POST http://localhost:3000/api/projects/{id}/chats \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"title": "Test Chat"}'

# Test 2: Send message with streaming
curl -N -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"chatId":"...","message":"Hello AI","model":"gpt-4"}'

# Test 3: Get chat history
curl http://localhost:3000/api/projects/{id}/chats/{chatId}/messages
```

**Success Criteria:**
- ✅ Create chat returns chat ID
- ✅ Streaming response arrives token-by-token
- ✅ Messages saved to database with tokens_used
- ✅ Chat history retrieved correctly

---

## 📋 PHASE 4: CODE GENERATION SYSTEM (20% - Days 3-5)

### Goal
Enable AI to generate, modify, and delete files based on user prompts. Show diffs before applying changes.

### Tasks

#### 1. Build Prompt Engineering System
**File to Create:**
- `/src/lib/ai/prompt-engineer.ts` (300 lines)

**Key Functions:**
```typescript
// System prompt for code generation
function buildSystemPrompt(framework: string, files: FileTree): string

// Inject project context
function injectProjectContext(prompt: string, context: ProjectContext): string

// Parse AI response to extract file operations
function parseAIResponse(response: string): FileOperation[]

// Types
type FileOperation = 
  | { type: 'create', path: string, content: string }
  | { type: 'modify', path: string, content: string, oldContent: string }
  | { type: 'delete', path: string }
```

**System Prompt Template:**
```
You are an expert React/Next.js developer. Generate code based on the user's request.

Project Context:
- Framework: Next.js 14.1.0
- Existing Files: [list of files]
- Package.json: [dependencies]

Rules:
1. Output ONLY JSON in this format:
{
  "operations": [
    {"type": "create", "path": "src/components/Button.tsx", "content": "..."},
    {"type": "modify", "path": "src/app/page.tsx", "content": "..."}
  ],
  "explanation": "Created Button component and updated homepage"
}

2. Use TypeScript and functional components
3. Follow Next.js 14 App Router conventions
4. Include proper error handling
```

#### 2. Build Diff Generation Library
**File to Create:**
- `/src/lib/ai/diff-generator.ts` (250 lines)

**Key Functions:**
```typescript
import { diffLines } from 'diff'

// Generate unified diff
function generateDiff(oldContent: string, newContent: string): CodeDiff

// Create snapshot before changes
async function createSnapshot(projectId: string, userId: string): Promise<string>

// Apply file operations atomically
async function applyOperations(operations: FileOperation[], projectId: string): Promise<void>

// Rollback to snapshot
async function rollbackToSnapshot(snapshotId: string): Promise<void>
```

#### 3. Create Generation APIs
**Files to Create:**

- `/src/app/api/ai/generate/route.ts` (250 lines)
  - POST: Generate code from prompt
  - Returns generation ID and diffs
  - Creates snapshot before changes
  - Status: "pending" (awaiting approval)

- `/src/app/api/ai/generations/[id]/approve/route.ts` (150 lines)
  - POST: Approve and apply changes
  - Applies file operations
  - Updates generation status to "applied"
  - Returns updated file tree

- `/src/app/api/ai/generations/[id]/reject/route.ts` (80 lines)
  - POST: Reject changes
  - Updates generation status to "rejected"
  - No files modified

- `/src/app/api/ai/generations/[id]/route.ts` (100 lines)
  - GET: Get generation details with diffs
  - DELETE: Delete generation record

**Testing Checklist:**
```bash
# Test 1: Generate code
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "...",
    "prompt": "Create a todo list component with add/delete functionality",
    "model": "gpt-4"
  }'

# Response should include:
{
  "generationId": "uuid",
  "operations": [...],
  "diffs": [...],
  "snapshotId": "uuid"
}

# Test 2: Approve changes
curl -X POST http://localhost:3000/api/ai/generations/{id}/approve

# Test 3: Verify files created
ls -la /projects/{projectId}/src/components/TodoList.tsx
```

**Success Criteria:**
- ✅ AI generates valid code
- ✅ Diffs calculated correctly
- ✅ Snapshot created before changes
- ✅ Files applied atomically
- ✅ Rollback works correctly

---

## 📋 PHASE 5: UI COMPONENTS (15% - Days 6-8)

### Goal
Build user-facing React components for AI interaction.

### Tasks

#### 1. Model Configuration UI
**Files to Create:**

- `/src/components/ai/ModelConfigModal.tsx` (350 lines)
```tsx
// Modal with tabs for each provider
// - OpenAI tab (API key input, test button)
// - Anthropic tab (API key input, test button)
// - Google Gemini tab (API key input, test button)
// - Auto mode (no key needed, shows priority)
// Save button → calls /api/ai/models/config
```

- `/src/components/ai/ModelSelector.tsx` (200 lines)
```tsx
// Dropdown component
// - Shows available models
// - Groups by provider
// - Shows free tier badge
// - Current model highlighted
// - onClick → updates selected model
```

- `/src/components/ai/ProviderCard.tsx` (150 lines)
```tsx
// Card showing provider status
// - Logo and name
// - API key status (configured/not configured)
// - "Configure" button → opens modal
// - "Test Connection" button
// - Default model badge
```

#### 2. Chat Interface UI
**Files to Create:**

- `/src/components/ai/ChatPanel.tsx` (400 lines)
```tsx
// Right sidebar panel (350px width)
// - Header: Model selector, New chat button
// - Messages container (scrollable)
// - Input at bottom
// - Streaming message with cursor
// - Code blocks with syntax highlighting
```

- `/src/components/ai/ChatMessage.tsx` (250 lines)
```tsx
// Individual message bubble
// - User messages (right aligned, blue)
// - AI messages (left aligned, gray)
// - Markdown rendering
// - Code syntax highlighting
// - Copy code button
// - Timestamp
```

- `/src/components/ai/ChatInput.tsx` (200 lines)
```tsx
// Textarea with send button
// - Auto-resize as user types
// - Shift+Enter for new line
// - Enter to send
// - Send button (disabled while streaming)
// - Character/token counter
```

- `/src/components/ai/StreamingMessage.tsx` (150 lines)
```tsx
// Real-time streaming display
// - Appends tokens as they arrive
// - Blinking cursor at end
// - Progress indicator
// - Cancel button (abort stream)
```

- `/src/components/ai/CodeDiffViewer.tsx` (300 lines)
```tsx
// Side-by-side or unified diff view
// - Green for additions
// - Red for deletions
// - Line numbers
// - Expand/collapse hunks
// - File path headers
```

#### 3. Approval UI
**Files to Create:**

- `/src/components/ai/ApprovalButtons.tsx` (150 lines)
```tsx
// Approve/Reject buttons for AI responses
// - Approve button (green, check icon)
// - Reject button (red, X icon)
// - Loading state while applying
// - Disabled after approval/rejection
```

**Testing Checklist:**
- ✅ Open model config modal
- ✅ Add OpenAI API key
- ✅ Test connection (should succeed)
- ✅ Select GPT-4 from dropdown
- ✅ Send message "Hello"
- ✅ See streaming response
- ✅ Send prompt "Create a button component"
- ✅ See code diff preview
- ✅ Click approve
- ✅ Verify file created

---

## 📋 PHASE 6: EDITOR LAYOUT TRANSFORMATION (10% - Days 9-10)

### Goal
Transform editor from 2-panel to 3-panel Dyad-style layout.

### Current Layout (editor-client.tsx)
```
┌─────────────────────────────────────────┐
│  File Tree (250px)  │  Monaco Editor    │
└─────────────────────────────────────────┘
```

### New Dyad Layout
```
┌────────────────────────────────────────────────────────┐
│  Project: MyApp | Model: GPT-4 | [Settings] [Logout]  │
├──────────┬────────────────────┬──────────────────────┤
│          │                    │                      │
│  File    │   Preview Pane     │  AI Chat Panel       │
│  Tree    │   (Iframe)         │                      │
│          │                    │  [GPT-4 ▼]  [+ New]  │
│  [+ New] │   [Refresh]        │  ┌─────────────────┐ │
│          │   [Open Tab]       │  │ Message History │ │
│  Chats:  │   [Console ▼]      │  │                 │ │
│  Chat 1  │                    │  │ User: Build...  │ │
│  Chat 2  │                    │  │ AI: Sure! ...   │ │
│          │                    │  │ [Approve]       │ │
│          │                    │  └─────────────────┘ │
│          │                    │  ┌─────────────────┐ │
│          │                    │  │ Type message... │ │
│          │                    │  └────────[Send]───┘ │
└──────────┴────────────────────┴──────────────────────┘
```

### Changes Required

**1. Update editor-client.tsx (500 lines → 700 lines)**
```tsx
// Remove Monaco Editor from center
// Add PreviewPane component
// Add ChatPanel component
// Add chat switcher to left sidebar
// Adjust ResizablePanels layout (3 panels instead of 2)
```

**2. Hide/Show Code Editor**
```tsx
// Option 1: Modal overlay for editing files
// Option 2: Replace preview with editor temporarily
// Option 3: Split preview pane into tabs (Preview | Code)
```

**3. Add Top Bar**
```tsx
// Project name
// Model selector (global)
// Settings button
// User menu
```

---

## 📋 PHASE 7: LIVE PREVIEW SYSTEM (Optional - 10% - Days 11-12)

### Goal
Show live preview of project in iframe with auto-reload.

### Tasks

#### 1. Preview Pane Component
**File to Create:**
- `/src/components/preview/PreviewPane.tsx` (300 lines)
```tsx
// Iframe for preview
// - URL: http://localhost:{port}
// - Auto-reload on file changes
// - Loading spinner
// - Error boundary
// - Console log capture
```

#### 2. Dev Server Management
**File to Create:**
- `/src/lib/preview/dev-server.ts` (400 lines)
```typescript
// Detect framework from package.json
function detectFramework(packageJson: any): 'nextjs' | 'react' | 'vite'

// Start dev server
async function startDevServer(projectId: string): Promise<PreviewServer>

// Stop dev server
async function stopDevServer(projectId: string): Promise<void>

// Get server logs
async function getServerLogs(projectId: string): Promise<string[]>

// Child process management
import { spawn } from 'child_process'
```

#### 3. Preview APIs
**Files to Create:**

- `/src/app/api/preview/[projectId]/start/route.ts` (150 lines)
  - POST: Start dev server
  - Spawn child process
  - Save to preview_servers table
  - Return port and status

- `/src/app/api/preview/[projectId]/stop/route.ts` (80 lines)
  - POST: Stop dev server
  - Kill process
  - Update status to "stopped"

- `/src/app/api/preview/[projectId]/logs/route.ts` (100 lines)
  - GET: Stream server logs
  - SSE for real-time logs

**Security Note:**
- Run dev servers in isolated Docker containers
- Assign random ports (3001-4000)
- Proxy through Next.js to avoid CORS

---

## 📋 PHASE 8: VERSION CONTROL (Optional - 5% - Day 13)

### Goal
Enable users to view history and rollback to previous versions.

### Tasks

#### 1. Version Timeline UI
**File to Create:**
- `/src/components/versioning/VersionTimeline.tsx` (350 lines)
```tsx
// Timeline of all changes
// - AI generations (automatic snapshots)
// - Manual snapshots
// - Click to preview
// - Rollback button
```

#### 2. Snapshot APIs
**Files to Create:**

- `/src/app/api/projects/[projectId]/snapshots/route.ts` (150 lines)
  - GET: List all snapshots
  - POST: Create manual snapshot

- `/src/app/api/projects/[projectId]/snapshots/[snapshotId]/restore/route.ts` (200 lines)
  - POST: Rollback to snapshot
  - Replace all files
  - Create new snapshot of current state (before rollback)

**Testing:**
```bash
# Create snapshot
curl -X POST http://localhost:3000/api/projects/{id}/snapshots

# List snapshots
curl http://localhost:3000/api/projects/{id}/snapshots

# Rollback
curl -X POST http://localhost:3000/api/projects/{id}/snapshots/{snapshotId}/restore
```

---

## 📋 PHASE 9: COMPREHENSIVE TESTING (5% - Day 14)

### Goal
Thoroughly test all features before user demo.

### Test Scenarios

#### Positive Scenarios
1. ✅ **User adds API key**
   - Open model config
   - Add OpenAI key: `sk-proj-...`
   - Test connection → Success
   - Save → Key stored encrypted

2. ✅ **User selects model**
   - Open model selector
   - Choose GPT-4
   - Selector updates

3. ✅ **User chats with AI**
   - Type "Hello, who are you?"
   - Press Enter
   - See streaming response
   - Response saved to history

4. ✅ **User generates code**
   - Type "Create a todo list component"
   - AI generates React component
   - See diff preview
   - Click Approve
   - File created successfully

5. ✅ **User views preview**
   - Click "Start Preview"
   - Dev server starts
   - Preview loads in iframe
   - Changes reflected automatically

6. ✅ **User rolls back**
   - Open version timeline
   - Click previous version
   - Preview diff
   - Click Rollback
   - Files restored

7. ✅ **Multiple users collaborate**
   - User A creates chat
   - User B sees chat appear
   - User B approves AI changes
   - User A sees new files

#### Negative Scenarios
1. ❌ **Invalid API key**
   - Add key: `sk-invalid`
   - Test connection → Error: "Invalid API key"
   - Save button disabled

2. ❌ **Rate limit exceeded**
   - Send 100 messages rapidly
   - See error: "Rate limit exceeded. Try again in 60 seconds."
   - Retry button appears

3. ❌ **Malformed AI response**
   - AI returns plain text instead of JSON
   - Error: "Failed to parse AI response"
   - Retry with different prompt

4. ❌ **Network timeout**
   - Disconnect network
   - Send message
   - Error: "Network error. Please check connection."

5. ❌ **Concurrent file edits**
   - User A and User B edit same file
   - Conflict detected
   - Last write wins (or show merge UI)

6. ❌ **Preview server crash**
   - Preview crashes (syntax error)
   - Error message in preview pane
   - "Restart Server" button

7. ❌ **Quota exhausted**
   - OpenAI quota exhausted
   - Suggestion: "Switch to Auto mode to use free Gemini"

### Testing Script
**Create:** `/scripts/test-ai-features.sh`
```bash
#!/bin/bash

# Test 1: Add API key
curl -X POST http://localhost:3000/api/ai/models/config \
  -H "Cookie: ..." \
  -d '{"provider":"openai","apiKey":"sk-...","isDefault":true}'

# Test 2: Test connection
curl -X POST http://localhost:3000/api/ai/models/test \
  -H "Cookie: ..." \
  -d '{"provider":"openai","apiKey":"sk-..."}'

# Test 3: Create chat
CHAT_ID=$(curl -X POST ... | jq -r '.id')

# Test 4: Send message
curl -N -X POST http://localhost:3000/api/ai/chat \
  -d "{\"chatId\":\"$CHAT_ID\",\"message\":\"Hello\"}"

# Test 5: Generate code
GEN_ID=$(curl -X POST http://localhost:3000/api/ai/generate \
  -d '{"prompt":"Create button"}' | jq -r '.generationId')

# Test 6: Approve
curl -X POST http://localhost:3000/api/ai/generations/$GEN_ID/approve

# Test 7: Verify file
test -f /projects/.../Button.tsx && echo "✅ File created"
```

---

## 📊 PROGRESS TRACKING

### Overall Progress
- ✅ Phase 1: Database & Schema (100%)
- ✅ Phase 2: AI Services & APIs (100%)
- ⏳ Phase 3: AI Chat System (0%) - NEXT
- ⏳ Phase 4: Code Generation (0%)
- ⏳ Phase 5: UI Components (0%)
- ⏳ Phase 6: Editor Layout (0%)
- ⏳ Phase 7: Live Preview (0%) - Optional
- ⏳ Phase 8: Version Control (0%) - Optional
- ⏳ Phase 9: Testing (0%)

**Total**: 40% Complete

### Time Estimates
- Phase 3: 2 days (AI Chat)
- Phase 4: 3 days (Code Generation)
- Phase 5: 3 days (UI Components)
- Phase 6: 2 days (Editor Layout)
- Phase 7: 2 days (Preview) - Optional
- Phase 8: 1 day (Versioning) - Optional
- Phase 9: 1 day (Testing)

**Total**: 10-14 days for remaining 60%

---

## 🚀 IMMEDIATE NEXT ACTIONS

### Right Now (Session Continuation)
1. **Start Phase 3: Create AI Chat APIs**
   - Create `/src/app/api/ai/chat/route.ts`
   - Implement streaming with Server-Sent Events
   - Test with curl

2. **Create Chat CRUD APIs**
   - Create chat creation endpoint
   - List chats endpoint
   - Message history endpoint

3. **Test Chat System**
   - Send test messages
   - Verify streaming works
   - Check database for saved messages

### Tomorrow
1. **Start Phase 4: Build Prompt Engineer**
   - Create system prompt template
   - Build JSON parser for AI responses
   - Test with manual prompts

2. **Build Diff Generator**
   - Integrate diff library
   - Generate unified diffs
   - Test with sample files

### This Week
1. Complete Phases 3-4 (Chat + Generation)
2. Start Phase 5 (UI Components)
3. Daily testing of completed features

---

## 📝 NOTES

### User Requirements (Direct Quote)
> "this app needs to 100% mimic Desktop Dyad all features such as building projects using promps, adding models, MCP , etc.. This web version needs to 100% mimic the user expereince of the desktop dyad version while continue to run in the web mode with multi developer collaborations"

> "carefully and comprehensively implement - 1. AI provider integrations (OpenAI, Claude, Gemini) 2. Chat interface UI (right panel) 3. Code generation system with diff preview 4. Live preview pane (center iframe) 5. Version control with rollback 6. Comprehensive testing 7. make sure the app is 100% web based and not desktop centric"

> "Thoroughly test both positive and negative scenarios before you confirm for human testing"

### Critical Success Factors
1. ✅ **Web-based only** - No desktop dependencies
2. ✅ **Multi-user collaboration** - Multiple devs in same project
3. ✅ **AI-powered development** - Generate code from prompts
4. ⏳ **Dyad-style UI** - 3-panel layout (files | preview | chat)
5. ⏳ **Model flexibility** - Support OpenAI, Claude, Gemini, Auto mode
6. ⏳ **Version control** - Snapshots and rollback
7. ⏳ **Thorough testing** - Both positive and negative scenarios

---

**End of Next Steps Plan**
