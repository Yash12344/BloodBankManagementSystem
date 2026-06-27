# Security Posture — BloodLine

How BloodLine addresses the OWASP Top 10 and other security requirements (NFR-4).

| Risk | Control in BloodLine |
|------|----------------------|
| **Broken access control** | RBAC enforced on **every** route via `requirePermission(module, action)`; permissions re-loaded from the DB each request, so revocation/suspension is immediate; the UI mirrors permissions but the server is authoritative. Branch scoping on every query. |
| **Cryptographic failures** | Passwords hashed with bcrypt; refresh tokens and password-reset tokens stored only as SHA-256 hashes; secrets from env, never in the client bundle; TLS at the edge with secure, httpOnly, SameSite=strict cookies. |
| **Injection** | Prisma parameterised queries throughout; no string-built SQL. Zod validates and strips every request body/query before it reaches a service. |
| **Insecure design** | Clinical safety gates enforced server-side (no inventory without an approved lab record; reactive units cannot be approved; issue requires reserved-for-request + compatible cross-match + unexpired). Money in integer minor units. |
| **Security misconfiguration** | `helmet` security headers + CSP; `x-powered-by` disabled; env validated at boot (fail-fast); least-privilege role defaults in the seed. |
| **Vulnerable components** | Pinned dependencies; CI runs install/typecheck/test/build; Dependabot/`pnpm audit` recommended in pipeline. |
| **Identification & auth failures** | JWT access (15m) + rotating refresh tokens with **reuse detection** (family revocation); OTP/MFA; login rate limiting + lockout; password reset is single-use and expiring and invalidates all sessions. |
| **Software & data integrity** | Append-only `audit_log` written in the same transaction as each mutation; optimistic concurrency (row `version`) on units/components/inventory/invoices prevents lost updates and double-issue. |
| **Logging & monitoring** | Structured logs with request IDs; audit trail queryable via the settings API; readiness/liveness probes. |
| **SSRF** | No user-supplied URLs are fetched server-side; outbound calls are to configured gateways only. |

## Additional controls
- **CSRF**: SameSite=strict cookies; state-changing requests are same-origin via the web BFF.
- **Rate limiting**: global limiter + stricter limiter on auth and report/export endpoints.
- **XSS**: React auto-escaping + CSP; no `dangerouslySetInnerHTML` on untrusted data.
- **Idempotency**: payment writes require an `Idempotency-Key`; safe to retry.
- **Data retention**: soft delete + audit only for clinical/financial records.

## Pre-launch checklist
- [ ] Rotate all seed secrets; enforce strong `JWT_*` secrets.
- [ ] `COOKIE_SECURE=true` and HTTPS/HSTS at the edge.
- [ ] Run `pnpm audit`; patch criticals.
- [ ] Verify RBAC on a sample of routes per role.
- [ ] Confirm backups + a test restore.
- [ ] Penetration test of auth and issue/billing flows.
