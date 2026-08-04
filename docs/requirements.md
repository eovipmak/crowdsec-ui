# CrowdSec Dashboard — MVP Requirements and Repository Foundation

Status: **Approved baseline** for the MVP (task 01). Owner: Product/architecture agent.
Reviewers: Product Owner, Development Lead.
Source plan: `docs/plans/deep-research-report.md`. Successor artifacts: command matrix (task 02), architecture/API/config contracts (task 03).

This document is the implementation-ready baseline for the MVP. It is **normative**: later tasks, implementation, and reviews are judged against it. Every section is testable as written. Changes require an approved update to this document.

---

## 1. Product goal

**REQ-001 — Internal single-administrator dashboard.** The product is an internal dashboard for CrowdSec that runs on the same host where CrowdSec is installed, and serves exactly one administrator. (Report §Executive Summary, §1, §2, §6.)

**REQ-002 — Native single-host deployment.** The MVP is installed directly on the CrowdSec host as a native Linux application; no containers and no separate infrastructure. (Report §5, §8.)

**REQ-003 — No external dependencies.** The dashboard requires no database server, no application database, and no external monitoring or identity infrastructure.

## 2. Source of truth and integration boundary

**REQ-010 — `cscli`-only source of truth.** CrowdSec is the source of truth, accessed exclusively through approved `cscli` commands. (Report §Executive Summary, §1, §2, §5.)

**REQ-011 — No CrowdSec database access.** The dashboard never accesses the CrowdSec database directly and never queries CrowdSec's internal storage (SQLite/`crowdsec.db`) behind LAPI. (Report §1, §2.)

**REQ-012 — No application database.** The dashboard does not own, create, or require an application database. Storage is limited to a local configuration file (single administrator account and server settings). It never stores copies of alert or decision data. (Report §2, §8.)

**REQ-013 — Strict command adapter.** The backend exposes a single adapter that invokes approved `cscli` commands, reads structured output where supported, converts command failures into clear messages for the interface, and controls process permissions so the dashboard can perform required commands without gaining unnecessary access. (Report §1.)

**REQ-014 — No arbitrary command execution.** The adapter accepts parameters only from an allowlist, never constructs commands directly from raw browser input, and never accepts arbitrary shell fragments, executable paths, or flags from the frontend. Browser input can select typed operation parameters only. (Report §1, §6; task 02 work.)

**REQ-015 — Resolved executable path.** The adapter uses a configured `cscli` path or locates `cscli` through the service environment. (Report §1; task 04.)

## 3. MVP pages and features

**REQ-020 — Required MVP pages.** The MVP provides exactly these pages: **overview**, **alerts**, **decisions**, **machines/status**, **scenarios/profiles/collections**, **allowlists**, **bouncers**, and **login**. (Report §3, §7; task 07.)

**REQ-021 — System overview.** The overview page displays CrowdSec status, machines, and current alert/decision counts. (Report §7.)

**REQ-022 — Alerts and decisions.** Alerts and decisions are searchable, filterable, paginated tables with detail views equivalent to the relevant `cscli` commands (`cscli alerts list`/`inspect`, `cscli decisions list`). (Report §1, §7.)

**REQ-023 — Machine and status views.** Machines/status are shown using `cscli machines` and suitable status commands. (Report §1, §7.)

**REQ-024 — Scenarios, profiles, collections.** Their current configuration is displayed; enable/disable operations are supported only when a corresponding `cscli` command exists and the action is explicitly defined in the command matrix. (Report §1, §7.)

**REQ-025 — Allowlists and bouncers.** Allowlists and bouncers are displayed and managed through supported `cscli` commands, per the command matrix. (Report §1, §7.)

**REQ-026 — Optional metrics.** Dashboard statistics (alert/decision history) are shown only when the data available through `cscli` is sufficient; they are ordinary CrowdSec data, updated through page refresh or simple bounded polling — never real-time streaming and never a monitoring-platform claim. (Report §1, §7.)

**REQ-027 — Mutation confirmation.** Every mutating control identifies the corresponding CrowdSec action and requires explicit confirmation for operations that may delete or change multiple items. (Report §7.)

**REQ-028 — Operation error display.** Failed commands are displayed with readable causes and a refresh status so the administrator can respond. (Report §7.)

## 4. Technology selection

**REQ-030 — Backend.** Go with `net/http` for the backend; CrowdSec integration via `os/exec` through a strict `cscli` allowlist adapter. (Report §8; tasks 04, 05.)

**REQ-031 — Frontend.** Next.js with TypeScript for the frontend. (Report §8; task 07.)

**REQ-032 — Styling.** Tailwind CSS. (Report §8; task 07.)

**REQ-033 — Charts.** A small charting library may be used only for alert/decision statistics; it does not replace a monitoring platform. (Report §8; task 08.)

**REQ-034 — Packaging.** Native Linux packaging: a Linux binary with frontend assets, run directly or under systemd. (Report §5, §8; task 11.)

## 5. Explicit exclusions (out of scope)

**REQ-040 — No containers.** Docker and Podman are excluded. (Report §3, §5, §8; task 11.)
**REQ-041 — No Kubernetes.** Excluded. (Report §5, §8.)
**REQ-042 — No CI/CD.** GitHub Actions, automated pipelines, and a separate QA process are excluded. (Report §4, §5, §9.)
**REQ-043 — No Grafana.** Excluded. (Report §5, §8.)
**REQ-044 — No Prometheus integration.** Excluded; metrics shown on the dashboard are ordinary CrowdSec data, not a Prometheus/Grafana integration. (Report §1, §5, §8.)
**REQ-045 — No notifications.** Email/webhook notifications, alerting, and monitoring systems are excluded. (Report §5, §6, §8.)
**REQ-046 — No backups.** No dashboard data backup/restore is required; CrowdSec remains the source of truth. (Report §5.)
**REQ-047 — No multi-user/RBAC.** One local administrator only; no multi-role RBAC or user management. (Report §6.)
**REQ-048 — No LDAP/OIDC.** External identity providers are excluded. (Report §6.)
**REQ-049 — No separate databases.** PostgreSQL, MySQL/MariaDB, and SQLite are not selected as dashboard databases. (Report §8.)
**REQ-050 — Other non-selected technologies.** Electron, Blazor, heavier backend frameworks, Vault, and DDoS-oriented rate limiting are excluded from the MVP. (Report §6, §8.)

## 6. Security requirements

**REQ-060 — Single-admin authentication.** One local administrator account; password stored as a secure hash; sessions/tokens expire and are protected from unauthorized access. No default discoverable password. (Report §6; task 06.)

**REQ-061 — Access restrictions.** Bind to localhost or a trusted internal network interface by default; use HTTPS when the dashboard crosses an untrusted network. (Report §5, §6; task 11.)

**REQ-062 — Least-privilege process.** Run under a service account with minimum filesystem permissions; do not run as root unless required by the CrowdSec installation method. (Report §5, §6; task 11.)

**REQ-063 — Secrets and logs.** Never display or record passwords, credentials, hashes, or CrowdSec tokens; error messages and logs must not expose secrets or sensitive command output. (Report §5, §6; tasks 04, 06, 12.)

**REQ-064 — Command authorization.** Allow only command groups and parameters defined in the command matrix. (Report §6; tasks 02, 04.)

## 7. Repository source directories (agreed foundation)

The following source directories are the agreed repository layout for the MVP. They are established here as a convention and realized by the tasks listed; task 01 creates no implementation code, so empty directories are not created until their owning task needs them.

| Directory | Purpose | Established by |
|---|---|---|
| `backend/` | Go module/package structure, `net/http` server, strict `cscli` execution adapter, authentication | tasks 04, 05, 06 |
| `frontend/` | Next.js + TypeScript dashboard, Tailwind CSS baseline, shared UI components and pages | task 07 |
| `config/` | Sample local configuration (`cscli` path, bind address, port, logging, session settings, non-secret placeholders) | task 11 |
| `assets/` | Built frontend static assets delivered with the native package | task 11 |
| `deploy/` | Native Linux packaging layout, systemd unit, service account and permission guidance | task 11 |
| `docs/` | Requirements (this file), command matrix, architecture/API/config contracts, administrator/installation/troubleshooting guides, review records | tasks 01, 02, 03, 12, 13 |

The requirements document and repository layout are owned by the Product/architecture agent (this task). Subsequent artifacts and code are owned per the task list below.

## 8. Later work ownership

Every planned feature of the report is assigned to a boundary with a clear later task. This list is the module/artifact ownership map.

| Boundary | Owned artifacts | Later task |
|---|---|---|
| Requirements & repository foundation | `docs/requirements.md`, repository layout | task 01 (this) |
| Command matrix | `docs/command-matrix.md`; typed operation names and request/response shapes; every MVP mutation and read gated on the command matrix | task 02 |
| Architecture, API contracts, configuration schema | `docs/architecture.md`; API route/status-code/JSON-envelope/pagination contracts; config schema and sample shape | task 03 |
| Backend | Go module under `backend/`; strict `cscli` adapter; `net/http` server, routing, JSON validation, static-asset boundary, health endpoint, secret-safe logging | tasks 04, 05 |
| Security | Single-admin authentication, password hashing, sessions, logout invalidation, CSRF, mutation authorization | task 06 |
| Frontend | Next.js/TypeScript app under `frontend/`; pages for login, overview, alerts, decisions, machines/status, scenarios/profiles/collections, allowlists, bouncers; Tailwind baseline; typed API client; reusable state components; overview/machines/statistics views; alerts/decisions workflows; component/allowlist/bouncer views | tasks 07, 08, 09, 10 |
| Deployment | `config/` sample configuration, `assets/` built frontend assets, `deploy/` native Linux packaging and systemd unit | task 11 |
| Documentation | Installation, configuration, administrator usage, troubleshooting, update/start/stop/restart guides | task 12 |
| Review | `docs/review-record.md`; cross-artifact security and scope sign-off | task 13 |

## 9. Deliverables and non-deliverables

**Deliverables:** requirements documentation (this file), command matrix, architecture diagram, backend and frontend source code, sample configuration, native/systemd installation instructions, administrator-account instructions, and troubleshooting documentation.

**Non-deliverables:** database migrations, backup/restore procedures, testing programs, monitoring platforms, and notification workflows. (Report §3.)

## Verification checklist (how this document is checked)

- **V1 — Section coverage.** Every section of `docs/plans/deep-research-report.md` maps to one or more REQ statements in this document. (Check: Executive Summary → REQ-001/REQ-010/REQ-027; §1 → REQ-010–015/REQ-022–026/REQ-044; §2 → REQ-001/REQ-011/REQ-012; §3 → REQ-020/REQ-040–049; §4 → REQ-040, REQ-042, REQ-045; §5 → REQ-002/REQ-040–046/REQ-061–063; §6 → REQ-047/REQ-048/REQ-050/REQ-060–064; §7 → REQ-021–028; §8 → REQ-030–034/REQ-049; §9 → task ownership, deliverables.)
- **V2 — Every planned feature has a later task.** Confirmed in the §8 ownership table; no report feature is left without an owning task. (task 02: commands; 03: architecture/API/config; 04–05: backend; 06: authentication; 07–10: frontend pages; 11: packaging/systemd; 12: documentation; 13: review.)
- **V3 — Excluded features are absent from implementation scope.** §5 exclusions (REQ-040–050) are restated as constraints in the later tasks' "Out of scope" sections, never as deliverables.
- **V4 — Constraints are non-overridable.** REQ-011, REQ-012, REQ-014, and REQ-064 cannot be interpreted as permission to add a database or arbitrary command execution; they are hard constraints for review (task 13 checklist items 2 and 8).
