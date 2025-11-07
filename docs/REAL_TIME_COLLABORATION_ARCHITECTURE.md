# Real-Time Collaboration Architecture

## Overview

Implementing real-time collaborative code editing similar to Google Docs, VS Code Live Share, or Figma multiplayer, with project invitation system and live cursor/selection tracking.

---

## Core Features

### 1. **Project Invitation System**
- Owner can invite developers by email
- Invitation management (pending/accepted/rejected)
- Role-based permissions (owner/editor/viewer)
- Revoke access at any time

### 2. **Real-Time Code Editing**
- Multiple developers edit same file simultaneously
- See others' cursors and selections in real-time
- Conflict-free concurrent editing (Operational Transform or CRDT)
- Live syntax highlighting and error detection

### 3. **Presence & Awareness**
- See who's online in the project
- See which file each collaborator is viewing/editing
- Color-coded user indicators
- Activity status (active/idle/offline)

---

## Technology Stack

### Backend
- **Socket.IO**: WebSocket server for real-time bidirectional communication
- **Operational Transform (OT)**: ShareDB or custom OT implementation
- **Redis**: Pub/Sub for multi-server scaling (future)
- **PostgreSQL**: Persistent storage for invitations, access control

### Frontend
- **Monaco Editor**: VS Code's editor component (supports real-time collaboration)
- **Y.js** or **Automerge**: CRDT library for conflict-free editing
- **Socket.IO Client**: WebSocket client
- **React Context**: Collaboration state management

---

## Database Schema

### Tables to Create

#### 1. `project_invitations`
```sql
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  invited_email VARCHAR(255) NOT NULL,
  invited_user_id UUID REFERENCES users(id),  -- NULL until accepted
  role VARCHAR(50) NOT NULL DEFAULT 'editor',  -- 'owner', 'editor', 'viewer'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected', 'revoked'
  token VARCHAR(255) UNIQUE NOT NULL,  -- Secure invitation token
  expires_at TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invitations_email ON project_invitations(invited_email);
CREATE INDEX idx_invitations_token ON project_invitations(token);
CREATE INDEX idx_invitations_project ON project_invitations(project_id);
```

#### 2. `project_collaborators` (Enhanced)
```sql
-- Already exists, enhance with:
ALTER TABLE project_collaborators ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'editor';
ALTER TABLE project_collaborators ADD COLUMN last_seen_at TIMESTAMP;
ALTER TABLE project_collaborators ADD COLUMN current_file_path VARCHAR(1000);
```

#### 3. `collaboration_sessions`
```sql
CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  socket_id VARCHAR(255) NOT NULL UNIQUE,
  file_path VARCHAR(1000),  -- Current file being edited
  cursor_position JSONB,  -- { line: number, column: number }
  selection_range JSONB,  -- { start: {...}, end: {...} }
  status VARCHAR(50) NOT NULL DEFAULT 'active',  -- 'active', 'idle', 'disconnected'
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_project ON collaboration_sessions(project_id);
CREATE INDEX idx_sessions_socket ON collaboration_sessions(socket_id);
```

#### 4. `file_operations_log` (Operational Transform)
```sql
CREATE TABLE file_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path VARCHAR(1000) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL,  -- 'insert', 'delete', 'replace'
  operation_data JSONB NOT NULL,  -- { position, text, length, etc }
  version_number INTEGER NOT NULL,  -- Incremental version for OT
  parent_version INTEGER,  -- Previous version this operation is based on
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_file_version UNIQUE(project_id, file_path, version_number)
);

CREATE INDEX idx_operations_file ON file_operations_log(project_id, file_path, version_number);
```

---

## System Architecture

### 1. **WebSocket Connection Flow**

```
Client                          Server                         Database
  |                               |                                |
  |--- Connect with JWT --------->|                                |
  |                               |--- Verify User --------------->|
  |                               |<--- User Valid ----------------|
  |<--- Connected (socket_id) ---|                                |
  |                               |                                |
  |--- Join Project Room -------->|                                |
  |                               |--- Check Access -------------->|
  |                               |<--- Access Granted ------------|
  |<--- Joined Room --------------|                                |
  |<--- Current Users List -------|                                |
  |                               |                                |
  |--- Open File (path) --------->|                                |
  |                               |--- Load File Content --------->|
  |                               |<--- File Content + Version ----|
  |<--- File Content + Users -----|                                |
  |                               |                                |
  |--- Edit Operation ----------->|                                |
  |                               |--- Transform OT -------------->|
  |                               |--- Save to Log --------------->|
  |                               |--- Broadcast to Room --------->|
  |<--- Operation Broadcast ------|                                |
  |                               |                                |
  |--- Cursor Move -------------->|                                |
  |                               |--- Broadcast Cursor ---------->|
  |<--- Other User's Cursor ------|                                |
```

### 2. **Operational Transform Algorithm**

**Scenario**: Two users edit the same line simultaneously

```javascript
// Initial state (version 1)
const content = "Hello World";

// User A: Insert "Beautiful " at position 6 (after "Hello ")
const opA = { type: 'insert', position: 6, text: 'Beautiful ', version: 1 };

// User B: Insert "!" at position 11 (end)
const opB = { type: 'insert', position: 11, text: '!', version: 1 };

// Server receives opA first → version 2
content = "Hello Beautiful World"

// Server receives opB → Must transform!
// opB was based on version 1, but current is version 2
// Transform: opB.position must account for opA's insertion
const transformedOpB = { 
  type: 'insert', 
  position: 11 + opA.text.length,  // 11 + 10 = 21
  text: '!', 
  version: 2 
};

// Result: "Hello Beautiful World!"
```

### 3. **Conflict-Free Editing Strategy**

We'll use **CRDT (Conflict-Free Replicated Data Type)** with **Y.js**:

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Create shared document
const ydoc = new Y.Doc();
const ytext = ydoc.getText('monaco');

// Connect to WebSocket provider
const provider = new WebsocketProvider(
  'ws://localhost:3001',
  'project-abc-file-xyz',
  ydoc
);

// Bind to Monaco Editor
import { MonacoBinding } from 'y-monaco';
const binding = new MonacoBinding(
  ytext,
  editor.getModel(),
  new Set([editor]),
  provider.awareness
);
```

**Why CRDT over OT?**
- **No central server required** for conflict resolution
- **Eventually consistent** - all clients converge to same state
- **Handles offline editing** - sync when reconnected
- **Simpler to implement** - Y.js handles complexity

---

## API Endpoints

### Invitation APIs

#### 1. POST `/api/projects/[projectId]/invitations`
Create new invitation
```typescript
Request: {
  email: string;
  role: 'editor' | 'viewer';
  expiresIn?: number; // hours (default 168 = 7 days)
}

Response: {
  id: string;
  invitationUrl: string;
  expiresAt: string;
}
```

#### 2. GET `/api/projects/[projectId]/invitations`
List all invitations for project
```typescript
Response: {
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: 'pending' | 'accepted' | 'rejected';
    invitedBy: { id: string; name: string; };
    createdAt: string;
    expiresAt: string;
  }>
}
```

#### 3. POST `/api/invitations/[token]/accept`
Accept invitation (public endpoint)
```typescript
Response: {
  project: { id: string; name: string; };
  role: string;
}
```

#### 4. POST `/api/invitations/[token]/reject`
Reject invitation

#### 5. DELETE `/api/projects/[projectId]/invitations/[id]`
Revoke invitation (owner only)

#### 6. DELETE `/api/projects/[projectId]/collaborators/[userId]`
Remove collaborator (owner only)

### Collaboration APIs

#### 7. GET `/api/projects/[projectId]/collaborators`
List active collaborators with presence
```typescript
Response: {
  collaborators: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isOnline: boolean;
    currentFile?: string;
    lastSeen: string;
    color: string; // Assigned color for cursor/selection
  }>
}
```

---

## WebSocket Events

### Client → Server

#### 1. `project:join`
Join project collaboration room
```typescript
{
  projectId: string;
  token: string; // JWT
}
```

#### 2. `file:open`
Open file for editing
```typescript
{
  projectId: string;
  filePath: string;
}
```

#### 3. `file:close`
Close file
```typescript
{
  projectId: string;
  filePath: string;
}
```

#### 4. `edit:operation`
Send edit operation (handled by Y.js sync protocol)
```typescript
{
  projectId: string;
  filePath: string;
  operation: {
    type: 'insert' | 'delete' | 'replace';
    position: { line: number; column: number };
    text?: string;
    length?: number;
  };
  version: number;
}
```

#### 5. `cursor:update`
Update cursor position
```typescript
{
  projectId: string;
  filePath: string;
  position: { line: number; column: number };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}
```

### Server → Client

#### 1. `project:joined`
Confirmation of joining room
```typescript
{
  projectId: string;
  collaborators: Array<{ id, name, color, currentFile }>;
}
```

#### 2. `collaborator:joined`
New collaborator joined
```typescript
{
  collaborator: { id, name, color };
}
```

#### 3. `collaborator:left`
Collaborator disconnected
```typescript
{
  collaboratorId: string;
}
```

#### 4. `file:opened`
Someone opened a file
```typescript
{
  collaboratorId: string;
  filePath: string;
}
```

#### 5. `edit:broadcast`
Edit operation from another user
```typescript
{
  collaboratorId: string;
  filePath: string;
  operation: {...};
}
```

#### 6. `cursor:broadcast`
Cursor update from another user
```typescript
{
  collaboratorId: string;
  name: string;
  color: string;
  position: { line, column };
  selection?: { start, end };
}
```

---

## Security Considerations

### 1. **Authentication**
```typescript
// Verify JWT on WebSocket connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const user = await verifyJWT(token);
  if (!user) return next(new Error('Unauthorized'));
  socket.userId = user.id;
  next();
});
```

### 2. **Authorization**
```typescript
// Check project access before joining room
socket.on('project:join', async ({ projectId }) => {
  const hasAccess = await checkProjectAccess(socket.userId, projectId);
  if (!hasAccess) {
    return socket.emit('error', { message: 'Access denied' });
  }
  socket.join(`project:${projectId}`);
});
```

### 3. **Rate Limiting**
```typescript
// Limit operations per second per user
const rateLimit = new Map(); // userId -> { count, resetAt }

socket.on('edit:operation', (data) => {
  const limit = rateLimit.get(socket.userId) || { count: 0, resetAt: Date.now() + 1000 };
  if (limit.count > 100) {
    return socket.emit('error', { message: 'Rate limit exceeded' });
  }
  limit.count++;
  rateLimit.set(socket.userId, limit);
});
```

### 4. **Input Validation**
- Validate all file paths (no `..`, no absolute paths)
- Sanitize operation data
- Validate cursor positions are within document bounds

---

## Scalability Architecture

### Multi-Server Support (Future)

```
Load Balancer
     |
     ├── App Server 1 (Socket.IO)
     ├── App Server 2 (Socket.IO)
     └── App Server 3 (Socket.IO)
              |
         Redis Pub/Sub
         (Message Bus)
              |
        PostgreSQL
```

**Redis Adapter for Socket.IO:**
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await pubClient.connect();
await subClient.connect();

io.adapter(createAdapter(pubClient, subClient));
```

---

## Performance Optimizations

### 1. **Debounce Cursor Updates**
```typescript
const debouncedCursorUpdate = debounce((position) => {
  socket.emit('cursor:update', { position });
}, 50); // 50ms delay
```

### 2. **Throttle Operations Broadcast**
```typescript
const throttledBroadcast = throttle((operation) => {
  io.to(`file:${fileId}`).emit('edit:broadcast', operation);
}, 16); // ~60 FPS
```

### 3. **Delta Sync (Only Send Changes)**
```typescript
// Instead of sending entire file:
const delta = {
  added: [{ line: 5, text: 'new code' }],
  removed: [{ line: 3 }],
  modified: [{ line: 10, text: 'updated' }]
};
```

### 4. **Connection Pooling**
- Reuse database connections
- Keep WebSocket connections alive with heartbeat
- Graceful reconnection with exponential backoff

---

## Implementation Phases

### Phase 1: Database & Invitation System (Day 1-2)
- Create database migrations
- Invitation CRUD APIs
- Email notification service
- Accept/Reject invitation flow

### Phase 2: WebSocket Infrastructure (Day 3-4)
- Set up Socket.IO server
- Authentication middleware
- Project room management
- Presence tracking

### Phase 3: Basic Code Editor (Day 5-6)
- Integrate Monaco Editor
- File open/save without real-time
- Syntax highlighting
- Basic editing

### Phase 4: Real-Time Sync (Day 7-9)
- Integrate Y.js CRDT
- Connect Monaco to Y.js
- Test concurrent editing
- Handle conflicts

### Phase 5: Cursors & Awareness (Day 10-11)
- Implement cursor tracking
- Show other users' selections
- Color-coded user indicators
- Activity status

### Phase 6: UI/UX Polish (Day 12-14)
- Collaborators sidebar
- Invitation modal
- Presence indicators
- Conflict resolution UI

---

## File Structure

```
src/
├── app/
│   └── api/
│       ├── projects/[projectId]/
│       │   ├── invitations/
│       │   │   ├── route.ts              # GET, POST invitations
│       │   │   └── [id]/
│       │   │       └── route.ts          # DELETE invitation
│       │   └── collaborators/
│       │       ├── route.ts              # GET collaborators
│       │       └── [userId]/
│       │           └── route.ts          # DELETE collaborator
│       └── invitations/
│           └── [token]/
│               ├── accept/route.ts       # POST accept
│               └── reject/route.ts       # POST reject
│
├── lib/
│   ├── collaboration/
│   │   ├── socket-server.ts             # Socket.IO setup
│   │   ├── room-manager.ts              # Room join/leave logic
│   │   ├── presence-tracker.ts          # Track user activity
│   │   ├── invitation-manager.ts        # Invitation logic
│   │   └── crdt/
│   │       ├── yjs-provider.ts          # Y.js WebSocket provider
│   │       └── monaco-binding.ts        # Bind Y.js to Monaco
│   │
│   └── db/
│       └── schema.ts                     # Add new tables
│
├── components/
│   ├── collaboration/
│   │   ├── InviteModal.tsx              # Send invitations
│   │   ├── CollaboratorsList.tsx        # Show active users
│   │   ├── PresenceIndicator.tsx        # Online status
│   │   ├── UserCursor.tsx               # Remote cursor overlay
│   │   └── ConflictResolution.tsx       # Handle merge conflicts
│   │
│   └── editor/
│       ├── CollaborativeEditor.tsx      # Monaco + Y.js
│       └── EditorToolbar.tsx            # Collaboration controls
│
└── hooks/
    ├── useCollaboration.ts              # Collaboration state
    ├── usePresence.ts                   # Presence tracking
    └── useRealtimeEditor.ts             # Editor sync
```

---

## Testing Strategy

### Unit Tests
- Invitation creation/acceptance
- Access control checks
- Operation transformation logic

### Integration Tests
- WebSocket connection/disconnection
- Room joining/leaving
- Message broadcasting

### E2E Tests
- Two users editing same file
- Cursor synchronization
- Conflict resolution
- Network interruption recovery

---

## Monitoring & Observability

```typescript
// Log key metrics
const metrics = {
  activeConnections: io.engine.clientsCount,
  activeProjects: roomManager.activeRooms(),
  messagesPerSecond: messageCounter.rate(),
  avgLatency: latencyTracker.average()
};

// Alert on issues
if (metrics.avgLatency > 100) {
  logger.warn('High latency detected', metrics);
}
```

---

## Next Steps

1. Review and approve architecture
2. Create database migrations
3. Implement invitation system
4. Set up Socket.IO server
5. Integrate Monaco Editor
6. Add Y.js for CRDT
7. Build UI components
8. Test with multiple users
9. Deploy and monitor

This architecture provides a solid foundation for Google Docs-like collaborative code editing with invitation management.
