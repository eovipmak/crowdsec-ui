# Plan: Feature Research — Ranked Candidates & Inspection Drill-Down Proposal

Date: 2026-08-17
Status: Selected — Candidate #1 (Inspect Completion & Drill-down Views) confirmed by user — ready for implementation
Type: Exploratory research (default invocation) → implementation-ready specification for top proposal
Supersedes: N/A (follows completion of `2026-08-17_feature-research-and-hub-inventory.md`)

---

## 1. Goal and Non-Goals

### 1.1 Goal (Research Phase)
Analyze the repository after the successful implementation of Hub Inventory (`hub.list`), identify domain and usability gaps across the dashboard, rank 5 candidate features by user value and implementation cost under lean/native constraints, and detail the top proposal to implementation-ready depth so execution can begin immediately upon user selection.

### 1.2 Goal (Recommended Feature — Candidate #1: Inspect Completion & Drill-Down Views)
Complete the frontend inspection and item drill-down capabilities for existing backend operations (`allowlists.inspect`, `machines.inspect`, `bouncers.inspect`):
1. **Allowlists Entries Drill-Down:** Expand allowlist cards/rows to display all contained items (`value`, `description`, `created_at`, `expiration`) in a clean tabular view, eliminating the need to SSH to see what IPs/CIDRs are whitelisted.
2. **Machine Detail Dialog:** Add an inspection dialog on the Machines table (`/machines`) displaying registration details, authentication type, OS, validation status, timestamps, and attached datasource counts.
3. **Bouncer Detail Dialog:** Add an inspection dialog on the Bouncers table (`/bouncers`) displaying full bouncer metadata, auto-creation status, revocation state, exact version, and last pull activity.

### 1.3 Non-Goals (All Candidates & This Plan)
- **Mutations / State-Changing Writes:** No write operations (`allowlists add/delete`, `machines delete`, `bouncers delete`, `decisions delete`). The read-only invariant remains preserved for Candidates #1–#4.
- **Enterprise Authentication / RBAC / Multi-User:** Deferred per `docs/architecture.md` § Out of scope; local loopback posture remains unchanged.
- **External Persistent Storage / Databases:** No SQLite/PostgreSQL tables added for the dashboard; all data is fetched live or from existing `cscli` and cached probes.
- **Observability / Monitoring Infrastructure:** No Prometheus text scrapers, Grafana dashboards, or automated pipeline scaffolding per lean scope guidelines.

---

## 2. Current-State Findings

### 2.1 Existing Feature Inventory
| Domain | UI State | API Operation | Status |
|---|---|---|---|
| Alerts | ✅ Table + Inspect Dialog | `alerts.list`, `alerts.inspect` | Fully wired with event inspection |
| Decisions | ✅ Table + IP Check | `decisions.list`, `decisions.check` | Fully wired |
| Machines | ⚠️ Table list only | `machines.list`, `machines.inspect` | **Backend inspect exists (`/machines/inspect/{id}`), UI lacks detail dialog** |
| Bouncers | ⚠️ Table list only | `bouncers.list`, `bouncers.inspect` | **Backend inspect exists (`/bouncers/inspect/{name}`), UI lacks detail dialog** |
| Allowlists | ⚠️ Card summary + IP Check | `allowlists.list`, `allowlists.inspect`, `allowlists.check` | **Backend inspect exists (`/allowlists/inspect/{name}`), UI lacks item list table** |
| Metrics | ✅ Overview + 14 Component Types | `metrics.show` | Fully wired with live auto-refresh |
| Hub Inventory | ✅ Per-type tables & status badges | `hub.list` | Fully wired with auto-refresh |
| Simulation | ❌ Missing | None | No UI or API coverage |
| AppSec Rules | ❌ Missing | None | No UI or API coverage |

### 2.2 Relevant Existing Files
- **Backend Routers:** `backend/routers/allowlists/inspect.py`, `backend/routers/machines/inspect.py`, `backend/routers/bouncers/inspect.py`
- **Frontend Pages:** `frontend/src/pages/Allowlists.tsx`, `frontend/src/pages/Machines.tsx`, `frontend/src/pages/Bouncers.tsx`
- **Frontend Hooks:** `frontend/src/hooks/useAllowlists.ts`, `frontend/src/hooks/useMachines.ts`, `frontend/src/hooks/useBouncers.ts`
- **UI Components:** `frontend/src/components/ui/dialog.tsx`, `frontend/src/components/DataTable.tsx`, `frontend/src/components/CapabilityBadge.tsx`, `frontend/src/pages/AlertInspectDialog.tsx`

---

## 3. Candidate Features Considered (Ranked 5 — Value × Cost)

| Rank | Candidate | User Value | Cost / Effort | Rationale & Trade-offs |
|---|---|---|---|---|
| **#1 (Recommended)** | **Inspect Completion & Drill-down Views (Allowlists Items, Machines & Bouncers Detail)** | **High** (Resolves major information blindspots) | **Low** (Backend APIs & probes already exist; pure UI & hook completion) | Backend endpoints (`allowlists.inspect`, `machines.inspect`, `bouncers.inspect`) were implemented in the initial rebuild but never exposed in the UI. Users currently cannot view which IP addresses are inside an allowlist or inspect machine datasources without CLI access. |
| **#2** | **Simulation Status & Scenario Exceptions Banner** | **High** (Critical for troubleshooting "alerts without bans") | **Low** (1 new endpoint + text parser + Overview/Decisions banners) | `cscli simulation status` reveals if simulation mode is active globally or for specific scenarios. High diagnostic value with minimal implementation footprint. |
| **#3** | **AppSec / WAF Rules & Configs Inventory** | **Medium-High** (Visibility into WAF virtual patching) | **Low-Medium** (2 new endpoints or Hub tab extension) | Surfaces active AppSec configurations and virtual patch rules (`cscli appsec-rules list -o json`). Directly relevant for web-facing deployments with AppSec enabled. |
| **#4** | **Time-Range & Substring Filter for Alerts & Decisions** | **Medium** (Better alert triage on busy servers) | **Medium** (Backend query parameter validation + UI date picker) | Adds `--since` / `--until` parameters to `alerts.list` and client-side or server-side substring searching for scenario names. |
| **#5** | **Supervised Decisions Delete (First Mutation)** | **High** (Emergency unban / lockout resolution) | **High** (Breaks read-only invariant, requires confirmation modal & audit) | Adds `DELETE /api/v1/decisions/{id}` and `DELETE /api/v1/decisions?ip=...`. High utility for incident response, but introduces write operations and security considerations. |

### 3.1 Selection Rationale for Top Proposal (#1)
- **Zero Backend Risk:** The backend routes and error handling for `allowlists.inspect`, `machines.inspect`, and `bouncers.inspect` are already tested and operational.
- **Immediate Usability Lift:** Viewing the list of exempted IPs in an allowlist is essential for security validation. Showing machine datasources and bouncer details eliminates routine SSH sessions.
- **Consistent UI Experience:** Matches the existing pattern established by `AlertInspectDialog.tsx`.

---

## 4. Detailed Specification: Candidate #1 (Inspect Completion & Drill-Down Views)

### 4.1 Architecture and Data Flow

```
1. Allowlists Page (/allowlists):
   - On page load, fetch allowlists summary list via useAllowlists()
   - User clicks on an allowlist card or "View Entries" button
   - Trigger useAllowlistInspect(name) -> GET /api/v1/allowlists/inspect/{name}
   - Render expanded table of allowlist items: Value (IP/CIDR) | Description | Expiration | Created At

2. Machines Page (/machines):
   - Table rows include an action or row-click to open MachineInspectDialog
   - Trigger useMachineInspect(machine_id) -> GET /api/v1/machines/inspect/{machine_id}
   - Dialog renders: Machine ID, IP, OS, Version, Heartbeat, Last Push, Auth Type, Datasources breakdown

3. Bouncers Page (/bouncers):
   - Table rows include an action or row-click to open BouncerInspectDialog
   - Trigger useBouncerInspect(name) -> GET /api/v1/bouncers/inspect/{name}
   - Dialog renders: Name, Type, Version, IP Address, OS, Last Pull, Created At, Revocation status
```

### 4.2 Exact Files to Modify and Create

#### Frontend Files to Create:
1. `frontend/src/pages/MachineInspectDialog.tsx` — Modal dialog displaying comprehensive machine metadata, datasources breakdown, and connection timestamps.
2. `frontend/src/pages/BouncerInspectDialog.tsx` — Modal dialog displaying bouncer metadata, OS, API key/auth info, and poll status.

#### Frontend Files to Modify:
1. `frontend/src/hooks/useAllowlists.ts` — Add `useAllowlistInspect(name: string | null)` hook and typed `AllowlistItem` interface.
2. `frontend/src/hooks/useMachines.ts` — Add `useMachineInspect(machine_id: string | null)` hook.
3. `frontend/src/hooks/useBouncers.ts` — Add `useBouncerInspect(name: string | null)` hook.
4. `frontend/src/pages/Allowlists.tsx` — Add expandable entries view or drawer/table for viewing individual items within an allowlist.
5. `frontend/src/pages/Machines.tsx` — Add row click / inspect button to open `MachineInspectDialog`.
6. `frontend/src/pages/Bouncers.tsx` — Add row click / inspect button to open `BouncerInspectDialog`.

#### Backend Files (Verification / Minor Refinements):
1. `backend/routers/allowlists/inspect.py` — Verify response schema matches `AllowlistDetail` contract.
2. `backend/routers/machines/inspect.py` — Ensure clean serialization of datasources metadata if present.
3. `backend/routers/bouncers/inspect.py` — Ensure clean serialization.

---

## 5. Interface and Schema Contracts

### 5.1 Allowlist Inspect Contract
- **Endpoint:** `GET /api/v1/allowlists/inspect/{name}`
- **Operation:** `allowlists.inspect`
- **Response Shape:**
```json
{
  "operation": "allowlists.inspect",
  "result": {
    "name": "vnh_ip",
    "description": "Vinahost",
    "created_at": "2026-08-02T16:32:14.835Z",
    "updated_at": "2026-08-03T22:52:18.036Z",
    "items": [
      {
        "value": "123.30.108.100",
        "description": "VPN01",
        "created_at": "2026-08-02T16:32:17.404Z",
        "expiration": "0001-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 5.2 Machine Inspect Contract
- **Endpoint:** `GET /api/v1/machines/inspect/{machine_id}`
- **Operation:** `machines.inspect`
- **Response Shape:**
```json
{
  "operation": "machines.inspect",
  "result": {
    "machineId": "central-api",
    "ipAddress": "127.0.0.1",
    "os": "ubuntu/24.04",
    "version": "v1.7.8-debian-pragmatic-amd64-63227459-linux",
    "isValidated": true,
    "auth_type": "password",
    "created_at": "2026-08-01T16:15:01.752945567Z",
    "updated_at": "2026-08-17T12:57:48.143636249Z",
    "last_heartbeat": "2026-08-17T12:57:48.143634832Z",
    "last_push": "2026-08-17T12:55:19.147489025Z"
  }
}
```

### 5.3 Bouncer Inspect Contract
- **Endpoint:** `GET /api/v1/bouncers/inspect/{name}`
- **Operation:** `bouncers.inspect`
- **Response Shape:**
```json
{
  "operation": "bouncers.inspect",
  "result": {
    "name": "linux-fw-01",
    "type": "crowdsec-firewall-bouncer",
    "ip_address": "125.212.217.195",
    "os": "Ubuntu/24.04",
    "version": "v0.0.34-debian-pragmatic-amd64-4144555453620958398aee64253dfd90bbc1f698",
    "auth_type": "api-key",
    "revoked": false,
    "auto_created": false,
    "created_at": "2026-08-02T16:26:39.250590681Z",
    "updated_at": "2026-08-17T12:57:59.203437422Z",
    "last_pull": "2026-08-17T12:57:59.184271979Z"
  }
}
```

---

## 6. Ordered Implementation Tasks

| Task ID | Description | Primary Files | Dependencies |
|---|---|---|---|
| **T1: Hook Extensions** | Implement `useAllowlistInspect`, `useMachineInspect`, and `useBouncerInspect` hooks with TypeScript definitions. | `frontend/src/hooks/useAllowlists.ts`, `frontend/src/hooks/useMachines.ts`, `frontend/src/hooks/useBouncers.ts` | None |
| **T2: Allowlist Entries View** | Enhance `Allowlists.tsx` to include an expandable card/table showing the allowlist entries (`items` array) with value, description, and status. | `frontend/src/pages/Allowlists.tsx` | T1 |
| **T3: Machine Inspect Dialog** | Create `MachineInspectDialog.tsx` and integrate inspection triggers into `Machines.tsx` table. | `frontend/src/pages/MachineInspectDialog.tsx`, `frontend/src/pages/Machines.tsx` | T1 |
| **T4: Bouncer Inspect Dialog** | Create `BouncerInspectDialog.tsx` and integrate inspection triggers into `Bouncers.tsx` table. | `frontend/src/pages/BouncerInspectDialog.tsx`, `frontend/src/pages/Bouncers.tsx` | T1 |
| **T5: Verification & Accessibility** | Verify keyboard navigation, ARIA attributes, responsive layout, and TypeScript typechecking. | `frontend/src/**/*` | T2, T3, T4 |

---

## 7. Acceptance Criteria & Verification Steps

### 7.1 Manual Verification
1. **Allowlists:**
   - Navigate to `/allowlists`.
   - Click on an allowlist (e.g. `vnh_ip`).
   - Confirm the list of 7 items (VPN01, Proxy02, WAF95, etc.) renders in a clean table with CIDR/IP values and descriptions.
   - Verify empty allowlists show "No entries in this allowlist".
2. **Machines:**
   - Navigate to `/machines`.
   - Click a machine row or "Inspect" button.
   - Confirm modal dialog opens with machine ID, OS, version, heartbeat, and validation status.
   - Press `Escape` or click close button; dialog closes cleanly.
3. **Bouncers:**
   - Navigate to `/bouncers`.
   - Click a bouncer row or "Inspect" button.
   - Confirm modal dialog opens with bouncer name, type, exact version, OS, and last pull timestamp.
4. **Build & Typecheck:**
   - Run `npm run typecheck` inside `frontend/` (zero errors).
   - Run `npm run build` inside `frontend/` (build succeeds).

---

## 8. User Selection and Next Steps

The user may select among the proposed candidates to proceed:
- **Option 1 (Recommended):** Inspect Completion & Drill-down Views (detailed above, ready for kanban breakdown or direct execution).
- **Option 2:** Simulation Status & Scenario Exceptions Banner.
- **Option 3:** AppSec / WAF Rules & Configs Inventory.
- **Option 4:** Time-Range & Substring Search for Alerts & Decisions.
- **Option 5:** Supervised Decisions Delete.
