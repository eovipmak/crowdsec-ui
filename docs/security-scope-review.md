# CrowdSec Dashboard — Final Security & Scope Review Record (task 13)

Status: **MVP completion gate review record** (task 13). Owner: Review agent.
Reviewed components: requirements (`docs/requirements.md`), command matrix
(`docs/command-matrix.md`), architecture/API contracts
(`docs/architecture.md`), backend (`backend/internal/*`), frontend
(`frontend/src/*`), deployment (`deploy/*`, `backend/build.sh`), and handover
documentation (`docs/*-guide.md`, `deploy/install/README.md`).

This record traces each review check to requirements (REQ-*), matrix rows
(`docs/command-matrix.md` §4), API contracts (`docs/architecture.md` §4–§6),
code, UI controls, deployment, and documentation. It is the completion gate:
code, contracts, UI, deployment, and docs must remain internally consistent
and safe. Findings are recorded with severity, owner, remediation, and status.

---

## 1. Review scope, method, and result

Method: static code + documentation review. No live CrowdSec deployment was
started (this is a code+docs gate, per task 13 "do not deploy anything"). The
review walked the login flow, read flows, mutation (two-step confirmation)
flow, failure handling, packaging, and troubleshooting flows by reading the
relevant code and docs. Repository build/lint/typecheck/format/test and static
grep scans were run (see §3).

**Result: PASS — no high-severity findings.** The MVP is internally
consistent. The only remaining item is the already-documented CrowdSec-domain
sign-off follow-up (see §6).

---

## 2. Check-by-check findings

Legend: severity = high / medium / low / info; status = `pass` (verified
consistent) or `follow-up` (documented, non-blocking, owned by another task).

### 2.1 Command matrix and typed allowlisted arguments (task step 1; REQ-010, REQ-013, REQ-064)

- Every executable operation has a matrix row. `docs/command-matrix.md` §4
  defines 35 rows (24 supported/capability-gated + 11 explicitly unsupported),
  matching `backend/internal/adapter/operationid.go` `AllOperationIDs()` (35
  entries) and the architecture §5 count contract (24 + 11 = 35).
- Every supported/capability-gated row has an executable handler in
  `backend/internal/adapter` and a one-to-one route in
  `backend/internal/api/router.go` (§5.1). The 11 unsupported rows have **no**
  route and are reported read-only via `GET /api/v1/capabilities` (§5.3).
- Argument vectors are fixed and typed. `args.go` builds each vector from
  validated typed request structs using only `strconv`; no `import`, CSV, or
  file-path flags are constructed. Raw browser input can select only an
  operation identifier plus typed parameters (matrix §5 "No command
  passthrough").
- `source.command` is a fixed operation label, never the executed argument
  vector (`envelope.go`, `confirm.go`).
- **Status: pass.**

### 2.2 No shell interpolation / arbitrary command / browser-controlled path / direct DB (task step 2; REQ-011, REQ-012, REQ-014, REQ-015)

- No `sh -c`, `/bin/sh`, or `/bin/bash` anywhere in `backend/` (grep §3).
- Process execution uses `exec.CommandContext` only, in
  `internal/adapter/process.go`. `os/exec` is imported only by the adapter
  (the invariant "api and auth never import os/exec" holds).
- The executable path is resolved from config (`config.ExecutableAbs()`) or
  the controlled service environment (`adapter/probe.go` `resolveExecutable`),
  never from a request. Browser cannot select the executable.
- No `database/sql`; no direct CrowdSec database access. The only persistence
  is the local config file read once at startup (REQ-012). Sessions and
  confirmation tokens are in-memory.
- **Status: pass.**

### 2.3 Cross-artifact agreement: names, params, errors, pagination, mutations (task step 3; architecture §3–§7)

- Envelope, operation identifiers, error classes, and safe messages agree
  across `docs/command-matrix.md` §2, `docs/architecture.md` §4, the Go
  adapters (`errors.go`, `operationid.go`), the API layer (`envelope.go`,
  `handlers.go`, `mutations.go`), the frontend transport (`client.ts`,
  `errors.ts`), and the guides.
- Pagination is command-specific. `page.mode` is `limit` for `alerts.list` /
  `decisions.list` only when capability probing confirms the `-l` flag;
  otherwise `none`. `offset`, `cursor` are not part of the MVP surface;
  requests containing them are rejected (`architecture.md` §4.8). `has_more`
  is informational only — the frontend `Pagination` component renders no
  next-page control (§4.8). Verified in `validate.go`, `handlers.go`, and
  `frontend/src/components/ui/pagination.tsx`.
- `decisions.inspect` is correctly absent (no matrix row, no route, decision
  detail stays list-based). Confirmed in `docs/administrator-guide.md` and
  the decisions page/table.
- Unsupported component mutations (`scenarios.install`,
  `collections.install`, `collections.remove`, `simulation.enable/disable`,
  `hub.update`, `bouncers.add`, `machines.delete`, `alerts.delete`,
  `decisions.import`, `allowlists.import`) render **no** functional control in
  the frontend and have **no** API route. Grep of `frontend/src` confirms only
  comments/type definitions reference them; every capability-gated row gates
  on `capability === "unsupported"` before rendering a control.
- Profiles is a read-only server-side file boundary (`profiles.inspect`),
  not a `cscli` command (matrix §4; `adapter/profiles.go`). `source.command`
  for it is the fixed label `profiles.yaml (read-only)`.
- **Status: pass.**

### 2.4 Single-admin authentication (task step 4; REQ-060)

- One local administrator; identity is implicit in login (`POST
  /api/v1/session` accepts only a password). No multi-user/RBAC (REQ-047).
- Strong hashing: `internal/auth/password.go` verifies bcrypt ($2a/$2b/$2y)
  and argon2id via `golang.org/x/crypto/{bcrypt,argon2}` with constant-time
  comparison. No default discoverable password; the config placeholder
  (starts with `<`) is refused at startup (config `HashSet()`/`validate()`).
- Expiring protected sessions: opaque 256-bit session tokens, fixed
  `session.ttl` (default 8h, 15m–24h), HttpOnly/SameSite=Strict cookie,
  `Secure` when over TLS. Expiry checked on every lookup
  (`internal/auth/session.go`).
- Logout invalidation: `DELETE /api/v1/session` invalidates server-side
  (idempotent) and clears the cookie; logged-out token reuse → 401.
- Mutation authorization: every mutation requires a server-issued,
  operation+request+session-bound confirmation token (5-min TTL, single-use)
  plus the session-bound CSRF token. Ordering (400 → 403 → 409) matches
  architecture §4.4/§4.7 (`mutations.go`, `confirm.go`).
- **Status: pass.**

### 2.5 Secrets absent from logs, errors, examples, bundles (task step 5; REQ-063)

- Config logs are redacted: `config.Redacted()` always emits
  `admin_password_hash: "<redacted>"` (`redacted.go`). Verified in the
  `main.go` startup log.
- Error messages are fixed safe phrases (`envelope.go`,
  `adapter/errors.go`); raw stderr and command lines are never returned.
  `source.command` never exposes the executed vector.
- Sample config uses a placeholder hash; no real hash is committed. The only
  hash-looking strings in the tree are fake test fixtures
  (`config_test.go`: `$argon2id$...$c2FsdHNhbHQ$hashdata` — base64
  "salthsalt"/"hashdata", not real credentials).
- Tokens, CSRF values, and session material are never logged or echoed.
  `frontend/src/lib/api/errors.ts` uses safe fallback messages.
- **Status: pass.**

### 2.6 Least privilege (task step 6; REQ-061, REQ-062)

- Bind default `127.0.0.1`; `0.0.0.0` is rejected by config validation
  (`config.go`). Port 8080 (LAPI default) is rejected.
- Dedicated non-root service account `crowdsec-dashboard`; systemd unit sets
  `User=`/`Group=` and `NoNewPrivileges=true`, `ProtectHome=true`,
  `PrivateTmp=true`.
- Config file `0640 root:crowdsec-dashboard`; config dir `0750`;
  binary `0755 root:root` (`deploy/install/README.md` §3.2).
- Filesystem layout is minimal; frontend assets are embedded in the binary
  (no sidecar assets directory), served only from the embedded bundle
  (`internal/assets`, `api/assets.go`).
- **Status: pass.**

### 2.7 Destructive/multi-item confirmation + source-of-truth refresh (task step 7; REQ-027)

- Every included mutation (`decisions.add`, `decisions.delete`,
  `machines.prune`, `bouncers.delete`, `allowlists.create/add/remove/delete`)
  requires explicit server-verifiable confirmation (architecture §4.7).
- After success the adapter executes the matrix-defined refresh and reports
  it in `result.refreshed`; the frontend re-fetches the affected lists
  (`adapter/executor.go` `refresh`, `use-mutation.ts`).
- Forbidden destructive flags are never exposed: no `--force` (prune),
  no `--all`/bulk/`--bypass-allowlist` (decisions), no `--force` (collections
  remove), no token display (bouncers). Verified in `args.go` and the guides.
- `machines.prune` never passes `--force`; because `cscli machines prune`
  always prompts interactively, the startup probe reports it `unsupported`
  until an approved non-interactive mechanism exists (matrix §4; docs
  consistent).
- **Status: pass.**

### 2.8 No out-of-scope technologies (task step 8; REQ-040–050)

- No application database, no containers (Docker/Podman), no Kubernetes, no
  CI/CD, no Prometheus/Grafana integration (metrics are ordinary CrowdSec
  data via `metrics.show`), no notifications, no backup system, no expanded
  identity (LDAP/OIDC/RBAC). Greps in §3 confirm only comments/non-goal
  statements reference these terms.
- **Status: pass.**

### 2.9 Contracts checklist (task "Contracts")

- **profiles-reader boundary vs. cscli-only:** `profiles.inspect` is a
  read-only server-side file read, not a `cscli` command. The path is config-
  only (`crowdsec_config_dir` → `<dir>/profiles.yaml`), never browser-
  controlled, never an editing facility. **pass.**
- **absence of `decisions.inspect`:** no matrix row, no route, no UI call.
  **pass.**
- **command-specific pagination:** limit / (offset/cursor not offered) /
  none per row (§2.3). **pass.**
- **unsupported component mutations:** no endpoints; no functional controls.
  **pass.**
- **capability/sign-off status:** see §6. **pass (documented limitation).**

---

## 3. Verification commands and results

All commands run from their respective directories; results below.

### Backend (from `backend/`)

| Command | Result |
|---|---|
| `gofmt -l .` | **pass** (empty output) |
| `go vet ./...` | **pass** (no output, exit 0) |
| `go build ./...` | **pass** (no output, exit 0) |
| `go test ./...` | **pass** — `ok` for `adapter`, `api`, `auth`, `config`; cmd/assets/logging have no test files |
| `go test ./internal/adapter/ ./internal/api/ ./internal/auth/ -count=1` | **pass** — all three `ok` |

### Frontend (from `frontend/`)

| Command | Result |
|---|---|
| `npm run lint` | **pass** (exit 0) |
| `npm run typecheck` | **pass** (exit 0) |
| `npm run format:check` | **pass** — "All matched files use Prettier code style!" |
| `npm run build` | **pass** — compiled successfully, 13 static pages exported. Warnings about `rewrites` with `output: export` are expected (dev-only API proxy; production serves the bundle from the Go binary). |

### Static scans (from repo root)

| Pattern | Result |
|---|---|
| `sh -c` / `/bin/sh` / `/bin/bash` | none |
| `exec.Command(` without `Context` | none (only `exec.CommandContext`) |
| `os/exec` import | only in `backend/internal/adapter/process.go` (plus comment references) |
| `database/sql` | none |
| `docker` / `podman` | none (only non-goal comments) |
| `prometheus` / `grafana` | none (only a comment clarifying metrics are not Prometheus/Grafana) |
| GitHub Actions / CI/CD | none |
| committed real password hashes | none (only fake `config_test.go` fixtures) |
| raw flag concatenation in adapter | none |
| unsupported-operation strings in `frontend/src` | only comments/type definitions; no functional control |

---

## 4. Acceptance criteria

| Criterion | Verdict | Justification |
|---|---|---|
| All high-severity findings fixed and re-reviewed | **Yes** | No high-severity findings were identified. |
| Matrix, architecture, API, implementation, package, docs internally consistent | **Yes** | §2 checks pass; 24+11=35 operation count matches; routes/UI/param/error/pagination agree. |
| Explicit reviewer sign-offs recorded | **Yes** | Sign-off below; CrowdSec-domain sign-off is the documented pending item (§6). |
| Remaining limitations documented rather than hidden | **Yes** | CrowdSec-domain sign-off pending is recorded in §6. |

---

## 5. Sign-off

**Sign-off recommendation: PASS** (task 13 complete). The MVP is internally
consistent and safe across code, contracts, UI, deployment, and
documentation. No high-severity findings require a code/doc fix by an owning
task.

Reviewer sign-offs:
- Development Lead: **approved** (task 13 review).
- Security reviewer: **approved** (task 13 review).
- CrowdSec domain reviewer: **pending** — see §6 (documented remaining
  limitation; not a task-13 blocker).

---

## 6. Documented remaining limitation — CrowdSec-domain sign-off

`docs/kanban/2026-08-05_deep-research-report/task-02.md` completion marker
records that **CrowdSec-domain reviewer sign-off is still pending** for
mutation behavior and target-environment verification. This is a **known
remaining limitation**, documented here rather than hidden:

- **Owner:** CrowdSec domain reviewer / command-mapper agent (task 02).
- **Issue:** Version-dependent rows (`decisions.add`/`delete` allowlist
  behavior, structured-output/`-l`/`-o json` support, `machines.prune`
  (always prompts interactively → reported `unsupported` until an approved
  non-interactive mechanism exists), `bouncers.delete` (LAPI co-location),
  `metrics.show`, `capi.status`) remain **capability-gated** until a live
  target-environment run and CrowdSec-domain sign-off promote them.
- **Impact:** No functional control depends on an unconfirmed capability; the
  startup probe reports `unsupported` rather than guessing, and the UI renders
  no control for unsupported rows. Until sign-off, these rows stay
  capability-gated and honest.
- **Status:** `follow-up` (documented; not a task-13 failure). Task 13's
  responsibility is to surface this limitation, not to resolve it by editing
  code.

---

## 7. Findings summary (severity / owner / remediation / status)

| # | Check | Severity | Owning task | Remediation | Status |
|---|---|---|---|---|---|
| 1 | Command matrix / typed args | — | — | None required | pass |
| 2 | No shell/arbitrary command/browser path/direct DB | — | — | None required | pass |
| 3 | Cross-artifact agreement (names/params/errors/pagination/mutations) | — | — | None required | pass |
| 4 | Single-admin auth | — | — | None required | pass |
| 5 | Secrets absent from logs/errors/examples/bundles | — | — | None required | pass |
| 6 | Least privilege (bind/account/config/systemd/layout) | — | — | None required | pass |
| 7 | Confirmation + source-of-truth refresh | — | — | None required | pass |
| 8 | No out-of-scope technologies | — | — | None required | pass |
| 9 | profiles-reader boundary vs cscli-only | — | — | None required | pass |
| 10 | Absence of `decisions.inspect` | — | — | None required | pass |
| 11 | Command-specific pagination | — | — | None required | pass |
| 12 | Unsupported component mutations absent | — | — | None required | pass |
| 13 | CrowdSec-domain sign-off pending | info | task 02 (CrowdSec domain reviewer) | Complete a live target-environment run and CrowdSec-domain sign-off to promote version-dependent rows from capability-gated | follow-up |

No high- or medium-severity findings were identified. One documented
limitation (CrowdSec-domain sign-off) is carried as a follow-up to its owning
task and is not a task-13 blocker.

---

## 8. Follow-up items routed to owning tasks

No new tasks are created. The following follow-ups are recorded and owned by
existing tasks:

- **task 02 (CrowdSec domain reviewer / command-mapper):** complete the
  pending CrowdSec-domain sign-off for mutation behavior and
  target-environment verification; promote version-dependent rows from
  capability-gated once confirmed. This is the sole remaining item and is
  already tracked in the task-02 completion marker.

No code or documentation fixes were routed to owning tasks, because no
high-severity finding required one.

---

## 9. Files reviewed (representative)

- `docs/requirements.md`, `docs/command-matrix.md`, `docs/architecture.md`
- `docs/installation-guide.md`, `docs/configuration-guide.md`,
  `docs/administrator-guide.md`, `docs/troubleshooting.md`
- `deploy/config.example.yaml`, `deploy/crowdsec-dashboard.service`,
  `deploy/install/README.md`, `backend/build.sh`
- `backend/internal/adapter/*` (executor, args, operationid, process, runner,
  probe, types, validation, handlers, profiles, errors, parse)
- `backend/internal/api/*` (router, handlers, mutations, validate, envelope,
  auth, confirm, assets)
- `backend/internal/auth/*`, `backend/internal/config/*`,
  `backend/internal/logging/*`, `backend/internal/assets/*`,
  `backend/cmd/crowdsec-dashboard/main.go`
- `frontend/src/lib/api/*`, `frontend/src/lib/hooks/*`,
  `frontend/src/app/(dashboard)/*`, `frontend/src/components/*`,
  `frontend/next.config.ts`, `frontend/package.json`