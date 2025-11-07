# Dyad Migration: Desktop (dyad-main) → Web (dyad-collaborative)

**Purpose:** Transform a single-user Electron-based local AI builder into a multi-tenant, collaborative, secure, cloud-ready web platform.  
**Core Shifts:** IPC → REST/WebSocket, SQLite + FS → PostgreSQL + Redis + Docker volumes, implicit trust → Auth + RBAC + encryption, local-only → scalable container deployment.

Original feature continuity:  
[AI Models](https://www.dyad.sh/docs/guides/ai-models) · [Chatting](https://www.dyad.sh/docs/guides/chatting) · [Debugging](https://www.dyad.sh/docs/guides/debugging) · [Previewing](https://www.dyad.sh/docs/guides/previewing) · [Versioning](https://www.dyad.sh/docs/guides/versioning) · [Importing](https://www.dyad.sh/docs/guides/importing) · [Mobile App](https://www.dyad.sh/docs/guides/mobile) · [Security Review](https://www.dyad.sh/docs/guides/security)

---
## 1. Framework Transformation
**Component / Area:** Core runtime

**Before (dyad-main):** Electron 38 + Vite + React; privileged main process; `registerIpcHandlers()`. Local-first, no multi-tenancy.
**After (dyad-collaborative):** Next.js 14 App Router + React 18; server routes in `src/app/api/**`; stateless scaling ready.
**Changes Made:** IPC → `GET/POST /api/...`; removed Electron deps; added `next`, `socket.io`, `drizzle-orm`.
**Rationale:** Zero install, collaboration, cloud distribution.
**Implementation Details:** `ipcMain.handle('models:list')` → `GET /api/ai/models/available`.
**Related Links:** [AI Models](https://www.dyad.sh/docs/guides/ai-models)

---
## 2. Communication Architecture
**Component / Area:** Transport layer

**Before:** Electron IPC synchronous calls; implicit trust.
**After:** REST + Socket.IO (`socket-server.ts`) for presence/cursors.
**Changes Made:** Chat/file actions now HTTP; presence events (`join-project`, `presence-update`).
**Rationale:** Standard browser integration + load balancing.
**Implementation Details:** Streaming via fetch/ReadableStream; auth per request.
**Related Links:** [Chatting](https://www.dyad.sh/docs/guides/chatting)

---
## 3. Database & Storage
**Component / Area:** Persistence

**Before:** Local SQLite (`better-sqlite3`), uncontrolled filesystem, single-user scope.
**After:** PostgreSQL + Drizzle ORM; Redis for cache/session; files confined to Docker volume `project_files`.
**Changes Made:** New relational schemas (users, projects, membership); removed local path utilities.
**Rationale:** Concurrency, durability, multi-tenant isolation.
**Implementation Details:** `DATABASE_URL` env; indexed email/ids.
**Related Links:** [Versioning](https://www.dyad.sh/docs/guides/versioning)

---
## 4. Authentication & RBAC
**Component / Area:** Identity & access

**Before:** Implicit local user; no role separation.
**After:** NextAuth credentials provider (`auth.ts`), JWT sessions, roles: Owner/Editor/Viewer.
**Changes Made:** Added `users.role`; session callbacks embed role/id.
**Rationale:** Least privilege, multi-user governance.
**Implementation Details:** `getServerSession(authOptions)` gates endpoints.
**Related Links:** [Security Review](https://www.dyad.sh/docs/guides/security)

---
## 5. AI Model Integration
**Component / Area:** Provider abstraction

**Before:** IPC handlers for local + remote models; plaintext API keys.
**After:** Provider factory (`AIProviderFactory`); `/api/ai/models/available`; AES-256-GCM encrypted keys (`encryption.ts`).
**Changes Made:** Removed local enumerations; standardized provider metadata.
**Rationale:** Secure secrets; consistent multi-tenant behavior.
**Implementation Details:** `encrypt(apiKey)`; server-side proxying only.
**Related Links:** [AI Models](https://www.dyad.sh/docs/guides/ai-models)

---
## 6. Collaboration & Real-Time Sync
**Component / Area:** Presence & editing

**Before:** Single-user; no presence.
**After:** Socket.IO presence (avatars, counts). Real-time file sync deferred (rollback) for stability.
**Changes Made:** `socket-server.ts`; events: `join-project`, `presence-update`; removed unstable `file-saved` broadcasting.
**Rationale:** Progressive enhancement—start with awareness before CRDT.
**Implementation Details:** Room naming `project:{id}`; keying by `userId` prevents duplication.
**Related Links:** [Chatting](https://www.dyad.sh/docs/guides/chatting)

---
## 7. Preview Server & Container Management
**Component / Area:** Runtime sandbox

**Before:** Local system browser; no port policy.
**After:** Reserved port range 8081–8099 for isolated dev servers; Docker network isolation.
**Changes Made:** Port mapping in `docker-compose.yml`; future sidecars.
**Rationale:** Controlled multi-project previews.
**Implementation Details:** Potential future: `http://localhost:8082/preview/{projectId}`.
**Related Links:** [Previewing](https://www.dyad.sh/docs/guides/previewing)

---
## 8. Versioning & File Management
**Component / Area:** Source & history

**Before:** Local Git operations via IPC; limited multi-user audit.
**After:** API-managed file CRUD + planned DB-backed version snapshots; diff via `diff` lib.
**Changes Made:** Introduced file endpoints; removed direct host FS scanning.
**Rationale:** Auditable change tracking + future rollback.
**Implementation Details:** `PUT /api/projects/{id}/files/{fileId}`; diff generation server-side.
**Related Links:** [Versioning](https://www.dyad.sh/docs/guides/versioning)

---
## 9. Import / Export Workflows
**Component / Area:** Project ingress/egress

**Before:** Direct FS copy/drag-drop.
**After:** Planned archive upload (`POST /api/projects/import`) & download endpoints.
**Changes Made:** Defined controlled scope; deferred implementation.
**Rationale:** Security boundary enforcement.
**Implementation Details:** Stream extraction + validation pipeline (future).
**Related Links:** [Importing](https://www.dyad.sh/docs/guides/importing)

---
## 10. Debugging & Observability
**Component / Area:** Diagnostics

**Before:** IPC debug handlers; local log scraping.
**After:** Central server logs; planned health/debug endpoints; potential Redis counters.
**Changes Made:** Removed OS-level privileged tools.
**Rationale:** Cloud-native observability path.
**Implementation Details:** Future `GET /api/debug/health` gated by role.
**Related Links:** [Debugging](https://www.dyad.sh/docs/guides/debugging)

---
## 11. Mobile & Responsive Design
**Component / Area:** UI adaptability

**Before:** Desktop-only layout fixed width.
**After:** Responsive panels; conditional collapse for narrow screens.
**Changes Made:** Removed Electron window assumptions; use Radix + CSS media queries.
**Rationale:** Anywhere access (review/approval flows).
**Implementation Details:** `@media (max-width: 900px)` collapses sidebars.
**Related Links:** [Mobile App](https://www.dyad.sh/docs/guides/mobile)

---
## 12. Build & Deployment
**Component / Area:** Packaging

**Before:** Electron Forge packaging (.dmg/.exe); auto-updater; local hardware.
**After:** `next build` → Docker image → `docker-compose up`; service triad (app/db/redis).
**Changes Made:** Added `Dockerfile`, `docker-compose.yml`; removed Forge scripts.
**Rationale:** Repeatable CI/CD; horizontal scaling.
**Implementation Details:** Multi-stage build; minimal runtime layer.
**Related Links:** [Previewing](https://www.dyad.sh/docs/guides/previewing)

---
## 13. Security Review (Critical)
**Component / Area:** Holistic security posture

**Before (Desktop):** Implicit trust; unrestricted filesystem; plaintext API keys; no RBAC; local-only exposure; single-user risk domain.
**After (Web):** Auth (NextAuth + JWT), RBAC (Owner/Editor/Viewer), encrypted API keys (AES-256-GCM), container isolation (`dyad-network`), server-proxy model provider calls, multi-tenant data isolation.
**Changes Made:** `auth.ts` session callbacks; `encryption.ts` added; schema role field; environment secrets (`NEXTAUTH_SECRET`, `ENCRYPTION_KEY`).
**Rationale:** Multi-tenant risk reduction, compliance readiness, secret hardening.
**Implementation Details:**
```ts
// Encryption
const ciphertext = encrypt(plainKey);
// RBAC middleware (conceptual)
ProjectAccessMiddleware.checkRole(projectId, ['owner','editor']);
// Auth session callback
async session({ session, token }) { session.user.role = token.role; }
```
**Infrastructure:** Redis (future lockout/rate limit), Docker network isolation, secret rotation strategy, potential audit logging (planned `security_events`).
**Containment:** Per-project boundary; compromise limited by role & encrypted data.
**Related Links:** [Security Review](https://www.dyad.sh/docs/guides/security)

---
## 14. Class & Module Organization
**Component / Area:** Code structure

**Before:** `src/ipc/handlers/*`, central main process orchestration.
**After:** API route functions (`src/app/api/...`), utilities modularized (`src/lib/encryption.ts`, `src/lib/auth.ts`).
**Changes Made:** Flattened server logic; removed Electron-specific modules.
**Rationale:** Simplicity, testability, clearer boundaries.
**Implementation Details:** `ipcMain.handle(...)` → `export async function GET()` pattern.
**Related Links:** [Debugging](https://www.dyad.sh/docs/guides/debugging)

---
## 15. Configuration & Environment Management
**Component / Area:** Runtime config

**Before:** `.env` local; path derivations; ad-hoc secrets.
**After:** Docker env injection; strict presence (`DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`).
**Changes Made:** Centralized env; removed OS homedir logic.
**Rationale:** Predictable deployments; easier secret rotation.
**Implementation Details:** Validate encryption key length ≥ 32 chars at startup.
**Related Links:** [Security Review](https://www.dyad.sh/docs/guides/security)

---
## 16. Trade-offs & Rationale Summary
**Component / Area:** Strategic considerations

**Trade-offs:** Dropped immediate local model adapters; deferred CRDT file sync; added auth complexity; introduced network latency; requires ops management.
**Benefits:** Collaboration, secure multi-tenant isolation, scalable AI integration, centralized governance.
**Future:** Reintroduce sandboxed local model tier; implement Yjs for real-time edits; audit logging; granular permissions; observability stack.
**Related Links:** [Versioning](https://www.dyad.sh/docs/guides/versioning) · [Importing](https://www.dyad.sh/docs/guides/importing)

---
## Cross-Section Consistency
- Roles repeated: Owner / Editor / Viewer.
- Encryption: AES-256-GCM w/ PBKDF2.
- Presence room key: `project:{id}`.
- Auth gate: `getServerSession(authOptions)`.
- File ops restricted to Docker volume root.

---
## Executive Summary
Migration modernizes Dyad from a privileged local desktop tool into a secure, multi-tenant web collaboration platform with audited access, encrypted secrets, structured persistence, and scalable provider integrations—positioning for enterprise and team adoption.

---
**End of Document**
