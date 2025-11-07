# Architecture Migration: dyad-main → dyad-collaborative

**Migration Date:** November 2025  
**Context:** Forked from dyad-main to create collaborative web platform

---

## 1. Core Framework Transformation

### dyad-main (Desktop)
- **Framework:** Electron 38.2.2 + Vite
- **Runtime:** Desktop application (Windows, macOS, Linux)
- **Reason:** Local-first, privacy-focused, full filesystem access

### dyad-collaborative (Web)
- **Framework:** Next.js 14.1.0 + React 18
- **Runtime:** Web application + Docker containers
- **Reason:** Enable multi-user collaboration, cloud deployment, browser-based access without installation

---

## 2. Communication Architecture

### dyad-main: IPC (Inter-Process Communication)
- **Pattern:** Electron's `ipcMain.handle()` / `ipcRenderer.invoke()`
- **Flow:** Renderer Process (React UI) ↔ Main Process (Node.js privileged)
- **Reason:** Desktop apps separate sandboxed UI from privileged system operations

### dyad-collaborative: REST API + WebSocket
- **Pattern:** HTTP endpoints + Socket.io for real-time
- **Flow:** Browser (React) ↔ Next.js API Routes ↔ Database/Redis
- **Reason:** Web apps use HTTP for state changes, WebSocket for live collaboration features

**Migration Impact:** All `IpcClient.getInstance().methodName()` calls converted to `fetch('/api/endpoint')` with proper auth headers.

---

## 3. Data Storage

### dyad-main: SQLite + Local Filesystem
- **Database:** better-sqlite3 (local file)
- **Files:** `~/dyad-apps/{appId}/` on user's machine
- **Reason:** Single-user desktop app, no network required, user owns all data

### dyad-collaborative: PostgreSQL + Redis + Docker Volumes
- **Database:** PostgreSQL 16 (multi-user ACID compliance)
- **Cache:** Redis 7 (sessions, presence, real-time state)
- **Files:** Docker volumes `/app/projects/{projectId}/`
- **Reason:** Multi-tenant architecture requires concurrent access, transactions, and centralized storage for collaboration

---

## 4. Authentication & Authorization

### dyad-main: None (Implicit)
- **Auth:** Filesystem permissions = user access
- **Sessions:** N/A - single local user
- **Reason:** Desktop app runs under user's OS account

### dyad-collaborative: NextAuth.js + JWT + RBAC
- **Auth:** JWT tokens, encrypted API keys (AES-256)
- **RBAC:** Owner/Editor/Viewer roles per project
- **Sessions:** Redis-backed with automatic expiry
- **Reason:** Multi-user web app requires identity verification, permission boundaries, and secure credential storage

---

## 5. AI Integration Differences

### dyad-main: Direct SDK Calls
- **Providers:** OpenAI, Anthropic, Google, Ollama, LMStudio
- **Storage:** API keys in local config files
- **Streaming:** IPC streaming handlers
- **Reason:** Local execution, user's API keys never leave machine

### dyad-collaborative: Proxy Pattern
- **Providers:** OpenAI, Anthropic, Google (cloud only)
- **Storage:** Encrypted in PostgreSQL per-user
- **Streaming:** HTTP streaming with Server-Sent Events
- **Reason:** Web apps can't expose user API keys to browser; server acts as secure proxy

**Local Models:** dyad-main supports Ollama/LMStudio (desktop-only). dyad-collaborative does not (web security boundary).

---

## 6. Preview Server Architecture

### dyad-main: Subprocess Management
- **Method:** Node.js `child_process.spawn()` in main process
- **Ports:** Dynamic allocation, direct localhost access
- **Process:** Electron manages dev server lifecycle
- **Reason:** Desktop has full process control, no containerization

### dyad-collaborative: Containerized Dev Servers
- **Method:** Docker exec spawns processes in app container
- **Ports:** Range 8081-8099 exposed via docker-compose
- **Management:** Database tracks PIDs, ports, status
- **Reason:** Web apps run in containers; preview servers must share container environment to access project files

**Recent Fix (Nov 6):** Added webpack detection with `PORT` environment variable to override hardcoded config ports, ensuring preview iframe connects to correct allocated port.

---

## 7. Collaboration Features (New in dyad-collaborative)

### Real-Time Editing
- **Tech:** Operational Transformation (OT) via Yjs + Socket.io
- **State:** Redis pubsub for presence, cursors, selections
- **Reason:** Multiple developers editing same files simultaneously

### File Versioning
- **Tables:** `project_snapshots`, `file_versions`
- **Trigger:** Auto-snapshot before each AI generation approval
- **Reason:** Rollback capability in collaborative environments where changes come from multiple sources

### Project Sharing
- **Table:** `project_collaborators` with role-based permissions
- **Invites:** Email-based or link sharing (planned)
- **Reason:** Enable team collaboration on shared projects

---

## 8. Deployment Model

### dyad-main: Installable Application
- **Distribution:** GitHub releases (.dmg, .exe, .AppImage)
- **Updates:** Electron auto-updater
- **Resources:** Runs on user's hardware
- **Reason:** Desktop software distributed as binaries

### dyad-collaborative: Container Orchestration
- **Stack:** Docker Compose (3 services: app, db, redis)
- **Scaling:** Horizontal scaling ready (add app replicas)
- **Resources:** Cloud VMs or on-premise servers
- **Reason:** Web apps deployed as services, containers ensure consistency

---

## 9. Build Tools & Dependencies

### dyad-main
```json
"electron": "38.2.2",
"@electron-forge/*": "^7.8.0",
"better-sqlite3": "^7.6.13"
```
**Build:** `electron-forge package` → native binaries

### dyad-collaborative
```json
"next": "14.1.0",
"drizzle-orm": "^0.29.3",
"ioredis": "^5.3.2",
"socket.io": "^4.6.1"
```
**Build:** `next build` → optimized static + server bundle → Docker image

---

## 10. Key Architectural Decisions

### Why Move from Electron to Next.js?
**Decision:** Enable multi-developer collaboration without requiring desktop app installation.  
**Trade-off:** Lost local model support (Ollama) and MCP integration; gained real-time collaboration and zero-install browser access.

### Why PostgreSQL over SQLite?
**Decision:** Multi-user concurrency, row-level locking, ACID guarantees for collaborative editing.  
**Trade-off:** Increased infrastructure complexity; gained transactional safety and scale.

### Why Keep File-Based Storage?
**Decision:** Projects remain file-system structured for compatibility with dev tools (git, npm, vite).  
**Consistency:** Both versions use filesystem; dyad-collaborative adds Docker volumes for isolation.

### Why Docker Compose?
**Decision:** Simplified deployment with guaranteed environment consistency (Node, Postgres, Redis versions).  
**Developer Experience:** `docker-compose up` provides working environment in 30 seconds.

### Preview Server PORT Fix (Nov 6)
**Problem:** Webpack projects with hardcoded `devServer.port: 9000` ignored allocated port 8081, causing timeout.  
**Solution:** Use `PORT` environment variable (webpack 4+ respects it) to override config file settings dynamically.

---

## 11. Migration Complexity Summary

| Component | Complexity | Reason |
|-----------|-----------|---------|
| IPC → REST API | **High** | Complete communication rewrite, added auth middleware |
| SQLite → PostgreSQL | **Medium** | Schema translation, async patterns, connection pooling |
| Local FS → Docker Volumes | **Low** | Path changes only (`~/dyad-apps` → `/app/projects`) |
| Single-user → Multi-tenant | **High** | Added user isolation, permissions, encrypted credentials |
| AI Streaming | **Medium** | IPC streaming → HTTP SSE, similar concepts different transport |
| Preview Servers | **High** | Process management + containerization + port allocation + framework detection |

---

## 12. What Stayed the Same

- **AI Prompt Engineering:** System prompts nearly identical (XML-like `<dyad-write>` tags)
- **File Operations:** Same create/update/delete logic, just REST-triggered instead of IPC
- **Monaco Editor:** Both use Monaco with TypeScript language server
- **Framework Detection:** Both detect Vite/Next.js/Webpack via config files
- **Build Tool Support:** Both run `npm install && npm run dev` for previews

---

## 13. Session Context: Recent Work

### Validation Phase (Nov 5)
- Comprehensive validation of AI vibe coding feature vs dyad-main
- **Grade:** A- (9 bugs fixed during validation)
- Confirmed architectural adaptation successful

### Preview Server Issues (Nov 5-6)
- **Issue 1:** React apps showed blank preview (no JSX transformation)
- **Solution 1:** Implemented Vite dev server instead of static http-server
- **Issue 2:** Webpack projects with hardcoded ports caused timeout
- **Solution 2:** Added PORT environment variable + webpack detection

### Current State (Nov 6)
- ✅ All Docker containers running (app, db, redis)
- ✅ Application accessible at http://localhost:3000
- ✅ Preview V2 with comprehensive framework support (Vite, Next.js, Webpack, CRA, Static)
- ⏳ Awaiting user testing of webpack project preview

---

## Summary

**dyad-main** is a privacy-focused, local-first Electron desktop app optimized for single developers who want full control and offline capability.

**dyad-collaborative** transforms this into a cloud-native, multi-tenant web platform enabling real-time team collaboration while maintaining the core AI-powered app building experience, at the cost of local model support and requiring internet connectivity.

The migration involved rewriting communication layers (IPC→REST), upgrading storage (SQLite→PostgreSQL), adding authentication/authorization, implementing real-time collaboration (WebSocket+OT), and containerizing the entire stack for consistent deployment.
