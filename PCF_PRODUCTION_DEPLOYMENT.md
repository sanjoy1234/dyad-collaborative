# Production Deployment (Pivotal Cloud Foundry)

Source Reference: Adapted structure from deepwiki 8.4 production deployment page. This file preserves the same section and subsection layout but specializes every item for Pivotal Cloud Foundry (PCF). Only standard, well-established PCF platform capabilities (Diego, GoRouter, Loggregator, UAA, Buildpacks, App Autoscaler, Service Bindings, Blue-Green Routing) are referenced. No speculative features included.

---
## Production Architecture Overview

The production architecture on PCF separates stateless application instances from managed backing services, enabling horizontal scaling, zero-downtime deployment and rapid rollback.

Diagram (conceptual):
Client → GoRouter (HTTPS + TLS termination) → App Instances (Next.js server) → Postgres Service (cf managed) / Redis Service / Object Storage (external) → Loggregator / Metrics → Operators

Architecture Decisions:

| Component | Local Dev (Compose) | PCF Production | Rationale |
|-----------|---------------------|----------------|-----------|
| Application Server | Single container | 3–10 instances (web process) | Horizontal scale, HA |
| Database | Local Postgres | Managed Postgres service (service instance) | Automated backups, patching |
| Cache | Local Redis | Managed Redis service | Low-latency session & ephemeral storage |
| File Storage | Docker volume | External object storage (S3/GCS/Azure) | Durability, CDN integration |
| SSL/TLS | Self-signed / none | GoRouter TLS + cert (ACM / Let’s Encrypt) | Secure transport |
| Load Balancer | Not present | GoRouter + (optional) external LB | Smart routing, health checks |
| Scaling | Manual | App Autoscaler policy | Elastic response to load |
| Logging | Local files | Central Loggregator stream | Centralized observability |
| Metrics | Ad-hoc | Platform metrics + custom app metrics | Operational insight |

---
## Cloud Platform Deployment Options (PCF Focus)

Supported approach: Deploy via CF Buildpack (Node.js) or pre-built OCI image (Docker). Buildpack recommended for simplicity and security scanning.

Service Mapping:
| Layer | PCF Resource | Notes |
|-------|--------------|-------|
| Compute | App (web process) | Stateless Next.js runtime |
| Database | postgres service instance | Bound via `cf bind-service` (VCAP_SERVICES) |
| Cache | redis service instance | Session, rate limiting counters |
| Object Storage | External S3/GCS/Azure | Access via SDK + credentials env vars |
| Routing | GoRouter routes | Map/unmap for blue-green, custom domains |
| Certificates | Platform-managed or custom | Automatic renewal when using ACM / Let’s Encrypt integration |
| Autoscaling | App Autoscaler service | Policy JSON applied post bind |

Deployment Modes:
- Buildpack: `cf push dyad-app -b nodejs_buildpack -m 512M --health-check-type http --health-check-http-endpoint /api/health`
- Docker Image: `cf push dyad-app --docker-image registry.example.com/dyad:prod -m 512M`

---
## SSL/TLS Configuration

TLS terminates at GoRouter. Use HTTPS routes only.

Certificate Provisioning:
1. Add custom domain: `cf create-domain org example.com`
2. Map route: `cf map-route dyad-app example.com --hostname app`
3. Upload / integrate certificate in platform (Ops-managed) or rely on automated cert management if available.

Force HTTPS Enforcement:
- Application: Add redirect middleware for any `http` scheme (if behind non-terminating proxy scenario) – typically unnecessary; GoRouter handles TLS.
- Security headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`.

NEXTAUTH_URL must use HTTPS: `NEXTAUTH_URL=https://app.example.com`

---
## Environment Variables for Production

Configured via `cf set-env` or manifest. Secrets stored in platform secret store or passed at deploy time (never committed).

| Variable | Example Value | Purpose |
|----------|---------------|---------|
| NODE_ENV | production | Enables prod optimizations |
| DATABASE_URL | Provided via VCAP_SERVICES | Connection string (extracted dynamically) |
| REDIS_URL | Provided via VCAP_SERVICES | Cache/session endpoint |
| NEXTAUTH_URL | https://app.example.com | Public base URL |
| NEXTAUTH_SECRET | 64-char hex | Session/JWT signing |
| ENCRYPTION_KEY | 64-char hex | Encrypt stored API keys |
| STORAGE_TYPE | s3 | Object storage backend |
| LOG_LEVEL | info | Reduce verbosity |
| MAX_FILE_SIZE_MB | 50 | Increased upload limit |
| SESSION_TIMEOUT_MINUTES | 480 | Extended session lifetime |

Secure Secret Practices:
- Use platform-level secret rotation (ops procedure)
- Never log secret values
- Different secrets per environment (dev/staging/prod)

---
## Database Configuration

Managed Postgres service bound to the app. Application retrieves credentials from `VCAP_SERVICES`.

Connection Handling:
- Use pooled connections (e.g. `pg` with `POOL_SIZE` env var)
- Avoid creating connection per request

Performance:
- Index critical query columns
- Periodic VACUUM / analyze (platform schedules or managed service)

Backups:
- Automated daily snapshots retained per policy (e.g. 7–30 days)
- Point-in-time recovery supported by managed Postgres offering

---
## File Storage Strategy

Move from local volume to object storage.

Migration Steps:
1. Implement storage abstraction (local vs S3)
2. Deploy with `STORAGE_TYPE=local` + background sync script
3. Copy existing files to bucket
4. Switch `STORAGE_TYPE=s3`
5. Validate read/write/delete flows
6. Remove obsolete volumes

Optimizations:
- Enable CDN (CloudFront / Cloud CDN)
- Lifecycle policy for archival (e.g. Glacier transition)
- Compress text assets prior to upload

---
## Scaling Strategies

Horizontal Scaling:
- Increase instances: `cf scale dyad-app -i 5`
- Autoscaler rules CPU / request throughput.

Sticky Sessions (WebSocket):
- GoRouter maintains connection routing; avoid disruptive restarts (use rolling deploy).

Database Read Throughput:
- Scale vertically or add read replicas if supported (managed service feature).

---
## Health Checks and Readiness Probes

HTTP Health Endpoint: `/api/health` returns status JSON with DB + cache probes.

Manifest:
```
health-check-type: http
health-check-http-endpoint: /api/health
```

Ensure endpoint responds quickly (<250ms) and includes application timestamp for freshness.

---
## Security Hardening

Checklist:
| Item | Status | Notes |
|------|--------|-------|
| HTTPS Only | Enforced | All routes mapped over TLS |
| Secrets Management | Implemented | Environment set via platform, not in repo |
| API Key Encryption | Implemented | AES-256-GCM with per-record IV |
| Password Hashing | Implemented | bcrypt (>=10 rounds) |
| SQL Injection Prevention | Implemented | Parameterized queries (ORM) |
| XSS Protection | Implemented | React escaping + CSP headers |
| Rate Limiting | Pending | Add Redis-based per-IP counters |
| CSRF Protection | Partial | NextAuth baseline; consider double-submit token |
| WAF / DDoS | Recommended | External provider (Cloudflare/AWS Shield equivalent) |

Headers:
- `Content-Security-Policy`
- `X-Frame-Options=DENY`
- `X-Content-Type-Options=nosniff`
- `Referrer-Policy=strict-origin-when-cross-origin`

Database Security:
- Grant least privilege role
- Rotate credentials on schedule

---
## Deployment Pipeline

Stages:
1. Build (Next.js): `npm ci && npm run build`
2. Test: unit + integration
3. Package: rely on buildpack (no custom Docker needed)
4. Deploy to staging: `cf push dyad-app-staging`
5. Smoke tests
6. Blue-Green promote to production

Blue-Green Strategy:
```
cf push dyad-green --no-route
cf map-route dyad-green example.com --hostname app
# Verify
cf unmap-route dyad-app example.com --hostname app
cf rename dyad-green dyad-app
```
Rollback:
```
cf rollback dyad-app
# Or re-map old route if retained
```

---
## Monitoring and Alerting

Key Metrics:
| Category | Metric | Threshold | Action |
|----------|--------|-----------|--------|
| App | HTTP 5xx rate | >1% | Inspect logs, consider rollback |
| App | p99 latency | >2s | Scale, profile slow endpoints |
| App | WebSocket connections | >1000/instance | Scale horizontally |
| DB | CPU utilization | >80% sustained | Investigate queries, scale vertically |
| DB | Connection usage | >75% pool | Increase pool or optimize reuse |
| Redis | Memory usage | >80% | Increase size / eviction tuning |
| Infra | Instance CPU | >80% 10m | Autoscale action |
| Infra | Memory | >90% | Leak investigation |

Tools:
- Loggregator (stream logs): `cf logs dyad-app`
- App Autoscaler metrics dashboard
- External APM (optional) for traces (e.g. New Relic / Dynatrace)

Alerts integrated with ops channels (PagerDuty / email / Slack).

---
## Backup and Disaster Recovery

Backups:
| Component | Strategy | Retention |
|-----------|----------|-----------|
| Postgres | Automated snapshots + PITR | 7–30 days |
| Redis | Non-critical ephemeral | N/A |
| Object Storage | Versioning + lifecycle | 90+ days |
| Secrets | Managed store versioning | Per policy |

RPO / RTO Goals:
- RPO: ≤5 minutes (database PITR)
- RTO: ≤30 minutes (route remap + restore)

DR Test: Quarterly restore drill using latest snapshot in staging space.

---
## Cost Optimization

Strategies:
1. Right-size memory (start 512M; adjust via metrics)
2. Autoscaler off-peak downscale
3. Minimize log verbosity (`LOG_LEVEL=info`)
4. Optimize build size (tree-shake, remove dev deps)
5. Cache static assets behind CDN
6. Compress payloads (gzip / brotli)

---
## Rollback Procedures

Scenarios:
1. Bad Deploy: `cf rollback dyad-app` or restore previous droplet ID.
2. Config Error: Revert env var → `cf restage dyad-app`.
3. Performance Regression: Scale down new green, reinstate previous blue route.
4. DB Migration Issue: Apply down migration; if data corrupt, restore snapshot + route maintenance page.

Verification Post-Rollback:
- Health endpoint 200
- Error rate normal
- Latency baseline restored

---
## Production Checklist

Pre-Deployment:
- Secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY) set & rotated
- Build succeeds reproducibly (`npm ci && npm run build`)
- Database service bound & connectivity verified
- Redis service bound & session test passed
- Object storage credentials validated
- Health endpoint responding locally & staging
- Autoscaling policy applied (min 3, max 10)
- Security headers enabled
- CSP tested (no blocked essential scripts)
- Monitoring dashboards created
- Alert rules (5xx, latency, autoscale) active

Post-Deployment Verification:
- `curl https://app.example.com/api/health` returns `healthy`
- Login flow works
- Project CRUD works
- File upload/download success
- AI generation endpoint returns response
- WebSocket collaboration active
- Logs streaming (no sensitive data)
- p95 latency within target (<1s typical, <2s threshold)
- Error rate <1%
- Autoscaler metrics registering

---
## Summary

PCF production deployment establishes a stateless horizontally scalable application tier, managed backing services, secure TLS termination, structured logging, autoscaling, and disciplined rollback pathways. The architecture accelerates iteration while maintaining operational resilience and security.
