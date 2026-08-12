# CrowdSec Dashboard — Administrator Guide

Status: **MVP handover documentation** (task 12). Owner: Documentation agent.
Predecessors: `docs/command-matrix.md` (task 02), `docs/architecture.md` (task 03), and the frontend pages (tasks 07–10).
Consumers: the single administrator operating every MVP page.

This guide describes each page, its filters, detail view, refresh behavior, and supported mutations, and cross-references the authoritative `cscli` operation rows in `docs/command-matrix.md` §4. It assumes the dashboard is installed and configured per `docs/installation-guide.md` and `docs/configuration-guide.md`.

---

## 1. How to read this guide

Every page maps to one or more matrix operations. Operations are one of:

- **Supported** — a functional control exists.
- **Capability-gated** — available only when the startup probe confirms the installed CrowdSec supports it; otherwise reported `unsupported`. Capability badges and read-only notices mark these.
- **Explicitly unsupported** — no control and no endpoint.

The UI renders a capability badge for each section and **never creates a functional control for an unsupported row**. Reads come from live `cscli` responses; there is no local store and no real-time stream. Refresh is **explicit** (a Refresh button) plus a **single bounded poll** (30 seconds) on the dashboard pages; there is no unbounded fetching.

## 2. Login page

Route `/login`. The dashboard is a **single-administrator** UI (REQ-001, REQ-060).

- Enter the administrator password (the identity is implicit; there is one account).
- On success the server sets the session cookie and the frontend navigates to `/overview`.
- A failed login shows an identical, non-enumerating message (`Invalid username or password.`).
- If already authenticated, the page redirects to `/overview`.

See `docs/configuration-guide.md` §3 for the secure initial setup and §4 for session behavior.

## 3. Overview page

Route `/overview`. Matrix operations: `alerts.list`, `decisions.list`, `machines.list`, `lapi.status`, `capi.status` (capability-gated/optional), `metrics.show` (optional).

Sections (each fetched independently so one failure does not hide the rest):

- **Current counts** — three summary cards: **Alerts** (`alerts.list`, limit 50), **Decisions** (`decisions.list`, limit 100), and **Machines** (`machines.list`). Each card links to its page and shows the current item count from the returned items only.
- **Status** — **LAPI status** (`lapi.status`), **CAPI status** (`capi.status`, optional/environment-dependent, rendered as an unsupported notice when not supported), and a **metrics** panel (`metrics.show` with component `lapi`).

**Refresh behavior:** an explicit **Refresh all** button plus a single bounded 30-second poll. Counting uses the returned current items only; no cursor/offset/history pagination is invented where the matrix reports page mode `none` (architecture §4.8).

**Mutations:** none — Overview is read-only.

## 4. Alerts page

Route `/alerts`. Matrix operations: `alerts.list` (read), `alerts.inspect` (read). `alerts.delete` is **explicitly unsupported** in the MVP and renders no control.

**Filters** (typed, from matrix `alerts.list`): **Scenario**, **IP or range**, **Scope**, and **Kind**. Values are typed strings; no expression language, SQL, regex, or flag strings are accepted. Apply filters on submit; **Clear filters** resets them. Filter state survives refresh and detail navigation within the page.

**Results per page:** a `limit` selector (25/50/100). Page mode is `limit` **only** when capability probing confirms the `-l` flag for the installed CrowdSec; otherwise page mode is `none`, `limit` is rejected, and no page-size control renders (architecture §4.8).

**Detail view:** selecting an alert opens **Alert detail** from `alerts.inspect` (page mode `none`). It shows ID, Started, Scenario, Scope, Value, and Decisions. There is no pagination inside the detail.

**Refresh behavior:** explicit **Refresh** plus a single bounded 30-second poll.

**Mutations:** none — Alerts is read-only. `alerts.delete` (bulk/filter deletion) is explicitly unsupported (matrix §4; architecture §5.3).

## 5. Decisions page

Route `/decisions`. Matrix operations: `decisions.list` (read), `decisions.add` (mutation), `decisions.delete` (mutation). `decisions.import` is **explicitly unsupported** and renders no control. There is no `decisions.inspect` row, so detail stays list-based.

**Filters** (typed, from matrix `decisions.list`): **IP or range**, **Scope**, **Type**, **Origin**, and **Scenario**. Same rules as Alerts — typed values only, no flag/SQL input.

**List:** shows active decisions from `decisions.list`. Page mode is `limit` only when capability probing confirms the `-l` flag; otherwise `none`.

**Add decision** (`decisions.add`):
- Fields: **IP or range** (single IP or CIDR), **Duration** (form `4h`, `30m`, `1d`, etc., bounded ≤ 365 days), **Reason** (1–256 characters, no line breaks).
- Flow: **Add decision** issues a confirmation token, a modal shows the server-issued action + command label, and **confirm** executes the mutation. After success the decisions list is refreshed.
- `--bypass-allowlist`, bulk add, `--origin`, `--scenario`, and arbitrary flags are **never** exposed (matrix §4; architecture §6.2).

**Delete decision** (`decisions.delete`):
- Field: **IP or range** — deletes decisions matching this IP or range.
- Flow: **Delete decision** issues a confirmation token, the modal confirms, and execution deletes the matching decision(s). After success the decisions list is refreshed.
- There is **no delete-by-ID, no `--all`, no bulk, no `--origin`/`--scenario`** (matrix §4).

**Refresh behavior:** explicit **Refresh** plus a single bounded 30-second poll.

**Unsupported states:** when `decisions.add`/`decisions.delete` are capability-gated or unsupported, the corresponding form renders a notice and no control.

## 6. Machines / status page

Route `/machines`. Matrix operations: `machines.list` (read), `lapi.status` (read), `capi.status` (read, optional/environment-dependent). `machines.delete` is **explicitly unsupported**.

**Machines** — a table of registered machines (`machines.list`, page mode `none`): **Machine ID**, **IP address**, **Validation** (Validated / Not validated), and **Last seen**. An empty list is valid. No pagination, cursor, or offset controls render.

**Status** — **LAPI status** (`lapi.status`) and **CAPI status** (`capi.status`, optional; rendered as an unsupported notice when not supported).

`machines.prune` is a capability-gated mutation that is **not** rendered on this page in the MVP. It is listed in the matrix as MVP-included only as environment-dependent; because `cscli machines prune` always prompts interactively and the adapter never passes `--force`, the startup probe reports `unsupported` until an approved non-interactive confirmation mechanism exists. No functional control until then (matrix §4; `deploy/install/README.md` §7).

**Refresh behavior:** explicit **Refresh all** plus a single bounded 30-second poll.

**Mutations:** none rendered in the MVP.

## 7. Scenarios / Profiles / Collections page

Route `/scenarios`. Matrix operations (all **read-only** in the MVP): `scenarios.list`, `scenarios.inspect`, `collections.list`, `hub.list`, `profiles.inspect` (read-only profiles-file boundary), `simulation.status`.

Sections:

- **Scenarios** — installed scenarios (`scenarios.list`, page mode `none`): Scenario, Description, Version, Status. **Read-only** — install/remove/enable/disable controls do not exist.
- **Collections** — installed collections (`collections.list`, page mode `none`).
- **Hub inventory** — hub inventory (`hub.list`, page mode `none`) with a **type** selector whose values come from the fixed enum (`parsers`, `postoverflows`, `scenarios`, `contexts`, `appsec-configs`, `appsec-rules`, `collections`). **Read-only** — `hub.update` is explicitly unsupported, so no install/update/remove control exists.
- **Profiles** — configured profiles (`profiles.inspect`). This is **not** a `cscli` command; it is a read of the server-side `/etc/crowdsec/profiles.yaml` through a separately approved configuration-reader boundary. Profile, Filters, and Decisions columns. **Read-only** — no profile editing, expression input, or notification wiring.
- **Simulation** — simulation status (`simulation.status`): **Simulation is on/off**. **Read-only** — `simulation.enable` / `simulation.disable` are explicitly unsupported and no toggle is rendered.

**Refresh behavior:** explicit **Refresh all** plus a single bounded 30-second poll.

**Mutations:** none. `scenarios.install`, `collections.install`, `collections.remove`, `simulation.enable`, `simulation.disable`, and `hub.update` are explicitly unsupported (matrix §4; architecture §5.3).

## 8. Allowlists page

Route `/allowlists`. Matrix operations: `allowlists.list` (read), `allowlists.check` (read), and the local mutations `allowlists.create`, `allowlists.add`, `allowlists.remove`, `allowlists.delete`. `allowlists.import` is **explicitly unsupported**.

**Allowlists** — a table of allowlists (`allowlists.list`, page mode `none`): items with a **Source** column. **Console-managed** allowlists/entries are read-only and carry no mutation controls; only **Local** allowlists are editable.

**Check allowlist** (`allowlists.check`) — enter an IP or CIDR and view whether it is covered by an allowlist (`{ matched: true|false }`). Invalid IPs are rejected before execution. This is a read — no confirmation.

**Create allowlist** (`allowlists.create`) — fields: **Name** (identifier: letters, digits, `_ . / : -`, max 256) and **Description** (1–256 characters, required). Confirmed mutation; after success the allowlists list is refreshed.

**Add entry** (`allowlists.add`) — on a local allowlist: **IP or range** (single IPv4 address or CIDR), optional **Expiration** (form `4h`, `30m`, `1d`, bounded ≤ 365 days), optional **Comment** (1–256 characters). Adding an entry may delete existing decisions, so after success both the allowlists list and the decisions list are refreshed. Confirmed mutation. No CSV paths or import flags are accepted.

**Remove entry** (`allowlists.remove`) — removes a single entry from a local allowlist by IP/range. Console-managed entries are rejected as read-only. Confirmed mutation; allowlists list refreshed.

**Delete allowlist** (`allowlists.delete`) — deletes a local allowlist and all of its entries. Console-managed/unknown names are rejected. Confirmed mutation; allowlists list refreshed. No bulk delete.

**Refresh behavior:** explicit **Refresh** plus a single bounded 30-second poll.

**Unsupported states:** create/add/remove/delete render controls only when the relevant mutations are usable; otherwise a notice is shown and no control renders.

## 9. Bouncers page

Route `/bouncers`. Matrix operations: `bouncers.list` (read), `bouncers.delete` (capability-gated mutation). `bouncers.add` is **explicitly unsupported**.

**Bouncers** — a table of registered bouncers (`bouncers.list`, page mode `none`). The **bouncer token is never accepted or displayed** (matrix §4; architecture §6.2).

**Delete bouncer** (`bouncers.delete`) — **capability-gated**: it is offered only when capability probing confirms the command exists **and** the dashboard is co-located with the Local API (LAPI), because `cscli bouncers` requires database access and is intended for the LAPI/master host. When unsupported, the delete control is omitted entirely and a notice explains that the dashboard must be co-located with LAPI. Deleting a bouncer is a confirmed mutation; after success the bouncers list is refreshed. The token is not displayed and cannot be recovered.

**Refresh behavior:** explicit **Refresh** plus a single bounded 30-second poll.

**Mutations:** `bouncers.delete` only, and only under the capability-gated conditions above. `bouncers.add` (token-bearing registration) is explicitly unsupported.

## 10. Cross-referencing the matrix

| Page | Matrix operations |
|---|---|
| Login | application routes: session login/status/logout |
| Overview | `alerts.list`, `decisions.list`, `machines.list`, `lapi.status`, `capi.status` (CG), `metrics.show` (CG) |
| Alerts | `alerts.list`, `alerts.inspect` |
| Decisions | `decisions.list`, `decisions.add`, `decisions.delete` |
| Machines / status | `machines.list`, `lapi.status`, `capi.status` (CG) |
| Scenarios / profiles / collections | `scenarios.list`/`inspect`, `collections.list`, `hub.list`, `profiles.inspect`, `simulation.status` |
| Allowlists | `allowlists.list`, `allowlists.check`, `allowlists.create`, `allowlists.add`, `allowlists.remove`, `allowlists.delete` |
| Bouncers | `bouncers.list`, `bouncers.delete` (CG) |

CG = capability-gated. All unsupported rows (`alerts.delete`, `decisions.import`, `machines.delete`, `bouncers.add`, `hub.update`, `scenarios.install`, `collections.install`, `collections.remove`, `simulation.enable`, `simulation.disable`, `allowlists.import`) render no functional control.

## 11. Non-goals

The administrator does **not** use this dashboard for: database backup/restore (REQ-046), monitoring platforms (REQ-043/044), notifications (REQ-045), containers or CI/CD (REQ-040–042), or multi-user identity/RBAC (REQ-047/048). Component install/remove, profile editing, arbitrary configuration editing, and Console management are not MVP operations (matrix §5).