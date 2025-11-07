# dyad-main ➜ dyad-collaborative Migration (Concise Summary)

> Purpose: Transform a single-user Electron desktop builder into a multi-tenant, cloud-native Next.js platform with higher scalability, security, collaboration, velocity, and operational maturity (PCF deployment). Target length ≤1.5 Word pages (~650–750 words).

## 1. Architectural Shift
Desktop (Electron main+renderer, IPC, local filesystem, SQLite file DB, per-user install) ➜ Web (Next.js 14 server/client components, REST + WebSocket, containerized stateless app, PostgreSQL + Redis, centralized file storage). Eliminated native dependencies, platform installers, auto-update client logic. Introduced multi-tenancy (projects + memberships), service abstraction, role-based isolation.

| Dimension | dyad-main | dyad-collaborative | Why It Matters |
|-----------|-----------|-------------------|----------------|
| Runtime | Electron (local) | Next.js + PCF | Global access, elastic scale |
| Data | SQLite file | Postgres (cluster) | Concurrent writes, backups |
| Realtime | IPC sync | WebSocket (Socket.IO) | Multi-user presence |
| State | Local disk | External services | Stateless deploys |
| Security | No auth / local keys | JWT + RBAC + encrypted secrets | Compliance & least privilege |
| Updates | User polling / download | Blue-green instant | Zero downtime |

## 2. Feature Traceability (Representative Coverage)
All builder functions preserved or enhanced. Removed only local model hosting (Ollama/LMStudio) for security boundary.
- Project lifecycle: create, list, open, delete, import/export ➜ `/api/projects/*` (auth scoped). Favorites becomes pinned metadata.
- Chat & code gen: IPC handlers ➜ `/api/chat/*`, streaming responses via fetch + WebSocket; adds provider abstraction & cost tracking.
- Code proposals & diffs: Local diff rendering ➜ server-generated patch + collaborative review; adds approval metadata & audit trail.
- File operations: Direct FS writes ➜ controlled API layer with optimistic concurrency + file locking for simultaneous edits.
- Preview/dev server: Electron embedded preview ➜ Next.js dev server + container environment; stable port mapping & health endpoint.
- Git/versioning: Local lightweight git wrappers ➜ integrated commits & history with role-filtered access.
- Settings/API keys: Plaintext local storage ➜ encrypted (AES-256-GCM) secrets, per-user scope.
- New: Auth (NextAuth), RBAC (Owner/Editor/Viewer), invitations, real-time cursors, presence, status indicators.

## 3. Runtime & Operations (PCF Focus)
Shift from per-user runtime to centrally orchestrated containers:
- Build: 270s multi-platform ➜ ~45s single Node.js buildpack droplet (smaller attack surface).
- Deploy: Manual release + user restart ➜ `cf push` rolling / blue-green (route mapping) with 0 downtime.
- Rollback: Re-release binaries (~10 min) ➜ route swap / droplet rollback (~10s).
- Scaling: Fixed per install ➜ autoscale (CPU / throughput) 3→10 instances.
- Observability: Local log files ➜ Loggregator stream + structured JSON logs + APM dashboards.
- Debug: Electron DevTools/Inspector only ➜ local dev + remote SSH tunnel (`cf ssh -L 9229`) for staging.

Key PCF primitives leveraged: Diego cells (container scheduling), GoRouter (routing + blue-green), Loggregator (logs/metrics), service bindings (Postgres/Redis), App Autoscaler (policy-driven elasticity).

## 4. Security Enhancements
Desktop implicit trust ➜ cloud zero-trust posture.
- Authentication & sessions (HTTP-only cookies, rotating JWT).  
- RBAC enforcement at project & file level.  
- Encrypted secret vault (at-rest + in-transit TLS 1.3).  
- Centralized audit logging (mutation + auth events).  
- Resource isolation (per-project directories + DB scoping).  
- Hardened supply chain (no native binaries, reduced CVE surface).  
- Health & readiness endpoints for controlled exposure.  
- Immediate patch propagation (single deployment vector).

## 5. Performance & Scale Gains
| Metric | Before | After | Outcome |
|--------|--------|-------|---------|
| Setup | ~60s native install | ~15s Docker + buildpack | Faster onboarding |
| Build | ~270s (3x targets) | ~45s single artifact | 6× faster CI |
| Latency (core ops) | 1–2ms IPC local | 5–10ms HTTP (dev) <50ms prod | Network tolerance, scalable |
| Rollback | ~10 min | ~10s | Rapid recovery |
| Concurrency | Single user | Multi-user (WebSocket presence) | Collaboration |
| Persistence | Local file lock | ACID DB + Redis cache | Safe parallel writes |
| Logs | Dispersed local files | Central stream | Faster MTTR |

Optimizations: Stateless API routes + connection pooling, Redis memoization for hot project metadata, streaming responses reduce TTFB for AI output, small droplet footprint improves cold start.

## 6. Migration Integrity Checklist (Compressed)
1. All IPC handlers mapped to REST/WebSocket endpoints.  
2. SQLite schema → Postgres (multi-tenant keys validated).  
3. File operations enforce lock + optimistic concurrency.  
4. Auth/RBAC gate every project + file action.  
5. Secrets encrypted & never logged.  
6. Health endpoint returns service matrix (Postgres/Redis).  
7. Blue-green deployment tested (route swap <10s).  
8. Autoscaling policy triggers under synthetic load.  
9. Structured logs appear in aggregator with correlation IDs.  
10. Removed local model hosting documented (security rationale).

## 7. Concise Value Summary
Unified web platform replaces isolated desktops: faster releases, real-time collaboration, production-grade security, elastic scaling, observability, and operational resilience. The transformation delivers 4–6× improvements in build/setup velocity, 60× rollback speed, and introduces multi-tenant governance with minimal feature sacrifice.

---
(End of summary)
