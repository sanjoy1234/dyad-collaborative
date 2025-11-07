# Core Runtime Transformation (Concise Summary)

Word-length target: ~600 words (fits <1.5 Word pages @ 11pt)

## I. Core Runtime Overview

| Aspect | dyad-main (Desktop) | dyad-web (PCF Container) | Rationale |
|--------|---------------------|--------------------------|-----------|
| Execution | User machine (Electron runtime) | Cloud containers (PCF Diego) | Centralized, multi-tenant, elastic scaling |
| Architecture | Node.js + Chromium (IPC bridge) | Next.js 14.1.0 (unified server + client) | Web-native runtime, removed IPC layer |
| Isolation | OS user boundary | Container + org/space isolation | Resource quotas, safer multi-tenancy |

---
## Dev Runtime Setup
**Desktop:** `npm install` (native modules, 60s) → `npm start` (Electron Forge + Vite). Per-platform build tooling required. Local SQLite + filesystem.

**Web (PCF-ready):** `docker-compose up -d` (15s) → `npm run dev` (Fast Refresh ~200ms). External Postgres + Redis via services. Optional early PCF validation: `cf push dyad-dev --no-start && cf set-env ... && cf start`.

**Gains:** 4× faster onboarding, reproducible layers, no native compilation friction.

---
## Build and Run
**Before:** Three separate OS bundles (`.dmg`, `.exe`, `.AppImage`). ~270s cumulative, ~650MB total artifacts, user distribution & auto-update lag.

**After:** Single cloud artifact (CF droplet or container) built once: ~45s build, ~120MB final runtime. Manifest-driven deployment:
```yaml
applications:
- name: dyad-web
  memory: 512M
  instances: 3
  services: [dyad-postgres, dyad-redis]
  health-check-type: http
  health-check-http-endpoint: /api/health
```
**Benefits:** Single pipeline, zero-downtime rollouts, instant rollback, unified observability.

---
## Debugging & Error Feedback Loop
**Before:** Local file logs + DevTools; reproduction → rebuild → retest (5–10 min loop).

**After:** Structured JSON logs to stdout → Loggregator → ELK/Splunk dashboards. `cf logs dyad-web --recent` or tail in real time. Error cycle cut to ~30s (code change → push → automatic route warm-up). Correlation IDs for distributed flows.

**Key Shift:** From isolated local logs to centralized, queryable, multi-instance telemetry.

---
## Dev Tunnel Setup (Communication Path)
**Before:** Internal Electron IPC (`ipcMain.handle` / `ipcRenderer.invoke`) – no network boundary, near-zero latency, tightly coupled.

**After:** Browser ↔ `/api/*` (HTTPS) + WebSocket channel (presence, live edits). Typical local latencies 5–10ms; production p95 <50ms behind GoRouter.

**Modes:**
1. Full local stack (Compose): Same-origin simplicity.
2. Hybrid: Backend on PCF, frontend local with rewrite proxy.
3. Remote QA: `ngrok http 3000` ephemeral tunnel.

**Rationale:** Clean separation enables scaling, auth, caching, and progressive enhancement.

---
## Application Debugging
| Layer | Before (Desktop) | After (Web/PCF) | Tooling |
|-------|------------------|-----------------|---------|
| UI | Chromium DevTools | Browser DevTools | React Profiler, Network tab |
| Server Logic | Main process inspector (`--inspect`) | Local Node inspect (`NODE_OPTIONS='--inspect'`) | VS Code attach |
| Remote Instance | Not applicable | `cf ssh -L 9229:localhost:9229` (non-prod only) | Secure tunnel |
| Observability | Local log files | Centralized logs + metrics | Loggregator, APM |

**Constraint:** No production live debugging ports—use logs + tracing.

---
## Container Management
**Development:** Compose orchestrates app + Postgres + Redis with health checks and resource hints.

**Production (PCF):** Declarative scaling + self-healing:
```
cf scale dyad-web -i 5 -m 1G
cf restart dyad-web   # Rolling
cf ssh dyad-web -i 0  # Ephemeral shell
```
Health endpoint aggregates DB + cache status (`/api/health`). Diego replaces failed instances automatically; GoRouter balances traffic.

**Value:** Operational determinism, resource governance, quick diagnosis.

---
## Production Deployment
**Strategy:** Blue-green (zero downtime). Flow:
```
cf push dyad-green --no-route
cf map-route dyad-green apps.pcf.example.com --hostname dyad
cf unmap-route dyad-web apps.pcf.example.com --hostname dyad
cf rename dyad-green dyad-web
```
**Rollback:** `cf rollback dyad-web` or re-map old route (<10s).

**Auto-Scaling:** Policy-driven (e.g., CPU >75% or throughput >1000 req/s → +1–2 instances, floor 3, ceiling 10). Burst traffic absorbed without manual intervention.

**Improvements:**
| Capability | Desktop | Web (PCF) | Delta |
|------------|---------|-----------|-------|
| Build Time | 270s | 45s | 6× faster |
| Rollback | 10 min | 10s | 60× faster |
| Update Propagation | User polling | Immediate | Real-time |
| Scaling | Single user env | Horizontal multi-instance | Elastic |
| Observability | Local only | Centralized metrics/logs | Full-stack |

---
## Summary
Shift from single-user packaged runtime to a multi-tenant, observable, rapidly deployable cloud runtime reduced feedback cycles, unified artifacts, enabled elastic scale, and strengthened operational resilience—while preserving functionality via HTTP/WebSocket abstractions instead of IPC.
