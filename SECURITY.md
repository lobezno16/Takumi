# Security

This document describes TakumiRoute's security posture and the precise,
verifiable meaning of "all security issues removed."

## Definition of "done"

> The codebase produces **zero findings** from the scanners in
> [§ Static analysis](#static-analysis--scanners), **every item** in the
> [checklist](#manual-checklist) is verified, and the
> [security test suite](#security-test-suite) passes.

This eliminates the common, known vulnerability classes for this stack. It is
a rigorous, verifiable bar — **not** a metaphysical guarantee that no
vulnerability can ever exist.

## Controls implemented

| Area | Control |
|------|---------|
| **Secrets** | All via `pydantic-settings` from env. `.env` gitignored; `.env.example` holds placeholders only. `gitleaks` in pre-commit + CI. Production refuses to boot with an empty `JWT_SECRET`. |
| **AuthN** | JWT **access** (short-lived) + **refresh** tokens, signed with an env secret; a `type` claim is enforced so a refresh token cannot be used as an access token. Argon2 password hashing (`passlib[argon2]`). |
| **AuthZ** | Deny-by-default: every non-public endpoint requires a valid bearer token via a shared dependency; role checks (`operator`/`admin`) via `require_admin`. **Object-level / tenant isolation:** every tenant-owned query is scoped by the caller's `organization_id`, so a user cannot read or act on another organization's depots, vehicles, stops, orders, or agent interactions — verified by `tests/security/test_tenant_isolation.py`. |
| **Input validation** | Strict Pydantic everywhere (`extra="forbid"`), enum-constrained slot codes/statuses, numeric bounds, bounded string lengths, request **body-size limit** (1 MB → 413), and **pagination** limits on list endpoints. |
| **SQL injection** | SQLAlchemy ORM / Core with bound parameters only; PostGIS via `func.*` constructs. A test fails the build on any string-interpolated SQL. |
| **CORS** | Explicit origin allowlist (the frontend origin) — never `*`. Restricted methods/headers. |
| **Security headers** | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` on every response; `Server` header removed. |
| **Rate limiting** | `slowapi`, Redis-backed, on auth and expensive endpoints (simulation, optimizer, agent). Keyed by bearer token, else client IP; `429` past threshold. |
| **PII & data** | Data minimization (only demo-necessary fields). PII/secret keys are scrubbed from structured logs **and** Sentry by a redaction processor; SQL echo is disabled so bound params (emails, addresses, hashes) never reach logs. Transport encryption (`https`/`wss`) and at-rest encryption are deployment responsibilities — see [Deployment posture](#deployment-posture). |
| **LLM / agent** | Recipient text is untrusted data and is the sole input interpreted; the parser can only emit `SlotCode | None`, never an action. The agent may only call allowlisted tools with enum/UUID-validated arguments, capped per order, every decision logged. Prompt-injection tests assert no off-allowlist action. |
| **SSRF** | OSRM and all external URLs are fixed configuration, not user-supplied. |
| **Containers** | Multi-stage builds, non-root `USER`, slim base, `.dockerignore` excludes `.env`/`.git`/tests/data, healthchecks defined. |
| **Errors** | A global handler returns a generic message to clients; full detail (with stack) goes only to structured server logs. |

## Static analysis & scanners

Wired into CI and `make security`; the build fails on findings:

- `pip-audit` — Python dependencies (no known high/critical CVEs)
- `npm audit --omit=dev` — frontend dependencies
- `bandit` — Python SAST
- `semgrep` (`p/python`, `p/owasp-top-ten`) — security ruleset
- `eslint` + `eslint-plugin-security` + `typescript-eslint` — frontend
- `gitleaks` — secret scanning

All dependencies are pinned; see `backend/pyproject.toml` and
`frontend/package-lock.json`.

## Security test suite

`backend/tests/security/` covers:

- prompt-injection resistance (`test_agent_injection.py`)
- no string-interpolated SQL, PII scrubbing, security headers, body-size
  limit, generic error handling, auth-required, refresh-token type
  enforcement (`test_hardening.py`)
- rate limiting returns `429` (`test_ratelimit.py`)

## Deployment posture (not built into the app)

These are operational responsibilities documented here for honesty:

- **Encryption at rest** — provided by the managed database / encrypted
  volumes (e.g., Postgres TDE or disk-level encryption), not application-level
  column encryption.
- **TLS / `wss`** — terminated at the ingress/load balancer in front of the
  API and WebSocket.
- **Secret rotation & retention** — operational policy; the app reads all
  secrets from the environment to make rotation a config change.

## Manual checklist

- [x] No secrets in repo/images/logs; gitleaks clean.
- [x] Every endpoint authenticated (except `/health`) and arguments validated.
- [x] `extra="forbid"`; body-size + pagination + rate limits enforced.
- [x] Zero string-interpolated SQL; ORM/bound params only.
- [x] CORS locked to known origin; security headers on every response.
- [x] PII scrubbed from logs/Sentry; SQL echo disabled.
- [x] Agent: untrusted-input handling, tool allowlist, validated args, injection tests pass.
- [x] External URLs fixed/allowlisted; no SSRF surface.
- [x] Containers non-root, minimal; no secrets in layers.
- [x] Generic client errors; no stack traces leaked.
- [x] `pip-audit`, `npm audit`, `bandit`, `semgrep`, eslint-security, gitleaks in CI.

## Reporting

For a real deployment, report vulnerabilities privately to the maintainers
rather than opening a public issue.
