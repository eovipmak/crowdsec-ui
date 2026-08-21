# Plan: Allowlists Check Bug Fix — Ranked Candidates & Next Proposal

Date: 2026-08-21
Status: Ready for implementation — Recommended #1 (allowlists.check bug fix)
Type: Exploratory research (default invocation) → implementation-ready specification for #1
Supersedes: follows `2026-08-18_feature-research-and-next-candidates.md` (simulation.status now shipped; time-range filtering shipped 2026-08-19)

## 1. Goal and Non-Goals

### Goal (research phase)
Enumerate the highest-value next work for this single-admin, single-port (8090),
read-only CrowdSec Dashboard, rank candidates by user value × implementation
cost under lean/native constraints, and detail the top proposal to
implementation-ready depth.

### Goal (recommended — Candidate #1: fix `allowlists.check`)
Fix the reproduced bug behind **open issue #1** ("Check an ip in allowlists"):
the `GET /api/v1/allowlists/check/{ip}` endpoint always reports
`{"matched": false}` even when the IP **is** in an allowlist, because the
handler searches for the wrong stdout marker.

### Non-Goals (all candidates — and this plan)
- **Mutations** (`decisions delete`, allowlist/machine/bouncer writes) — the
  read-only invariant holds; the only mutation candidate is ranked last and
  deferred (see §2.3).
- **Auth/session/RBAC** — still deferred per `docs/architecture.md` § Out of
  scope; loopback-bound posture unchanged.
- **Observability/CI-CD/test scaffolding** — explicitly excluded per workflow
  rules; no pytest, no Grafana/Prometheus/alerting.
- **New nav pages for appsec/contexts** — already surfaced by the existing
  `hub.list` payload + `Hub.tsx` fallback rendering (see §2.3 finding).
- **`config`, `setup`, `support`, `hubtest`, `completion`, `simulation`,
  `appsec-rules`, `appsec-configs`** — excluded per workflow rules.

## 2. Current-State Findings

### 2.1 What exists today (inventory)
- **Backend:** FastAPI + Pydantic v2, `backend/main.py:app` (uvicorn `:8090`),
  `CscliRunner` (`asyncio.create_subprocess_exec`, positional argv, no shell),
  17 operation labels in `backend/envelope.py`, 6 startup probes in
  `backend/capabilities.py` cached to `app.state.capabilities`. All
  `GET /api/v1/*` enveloped; 10 error codes; stderr WARN-truncated, never
  returned; `Cache-Control: no-store`.
- **Operations shipped (verified present in code):** `alerts.list/inspect`,
  `decisions.list/check`, `machines.list/inspect`, `bouncers.list/inspect`,
  `allowlists.list/inspect/check`, `status.lapi/capi`, `metrics.show`,
  `hub.list`, `simulation.status`, `capabilities.list` (meta).
- **Frontend:** Vite 6 + React 19 + TS strict + Tailwind v4 + shadcn/ui +
  React Router 7 + TanStack Query v5. Routes: `/overview`, `/alerts`,
  `/decisions`, `/machines`, `/bouncers`, `/allowlists`, `/metrics`, `/hub`.
  `Allowlists.tsx` has an in-page "Check IP" form driven by
  `useAllowlistCheck(ip)` → `GET /api/v1/allowlists/check/{ip}` → badges
  "Matched — exempt" / "Not matched".
- **Completed this cycle:** all four 2026-08-18 candidates are done —
  simulation banner (`simulation.status`), time-range + pagination
  (`since`/`until`/`scenario_contains`/`offset`, 2026-08-19), plus the earlier
  hub inventory and inspection drill-down.
- **Open issues (GitHub, `gh issue list`):**
  - **#1 (bug)** "Check an ip in allowlists" — "the address exists in the
    list, but the search reports it as not found."
  - **#2 (documentation)** "setup script" — an install-verification `.sh`.

### 2.2 Bug reproduction (verified on this host, CrowdSec v1.7.8)

```text
$ cscli allowlists check 123.30.108.100        # known-present IP (vnh_ip)
123.30.108.100 is allowlisted by item 123.30.108.100 from vnh_ip (VPN01)
$ cscli allowlists check 8.8.8.8               # absent IP
8.8.8.8 is not allowlisted
$ cscli allowlists check 1.2.3.4               # absent IP
1.2.3.4 is not allowlisted
```

Both paths exit `0`. The backend handler
(`backend/routers/allowlists/check.py`) computes:

```python
text = result.stdout.decode(errors="replace").lower()
matched = "found" in text
```

The literal `"found"` appears in **neither** output:
- matched case: `"…is allowlisted by item…"` → no `"found"`.
- unmatched case: `"…is not allowlisted"` → no `"found"`.

Therefore `matched` is **always `false`**, so the UI always shows
"Not matched" for every IP — exactly the reported symptom. Root cause is
confirmed and self-contained (one line).

### 2.3 Research summary — candidates considered (ranked 5 — value × cost)

| Rank | Candidate | Value | Cost | Rationale |
|---|---|---|---|---|
| **#1 Recommended** | **Fix `allowlists.check` marker bug** (issue #1) | High | Tiny | Reproduced, one-line cause. Security-relevant correctness bug: an IP that *is* exempted reads as *not* exempted, potentially driving a wrong operator decision. Open GitHub issue. No API/frontend/config change. |
| #2 | **Live Log-Pipeline Debugger (`cscli explain`)** | Medium-High | Medium | `cscli explain --log <line> --type <t>` shows which parsers/successful scenarios fired without SSH. Verified: real command, text-only output (no stable JSON; `-o json` still emits emoji/tree text), ~3.2 s per line. Needs type allowlist + log-length cap. |
| #3 | **System/Version info (`cscli version`)** | Low | Tiny | Near-zero cost; `cscli version` returns text (title/codename/GoVersion/platform). Fits an Overview footer or a small "System" card. Verified: `-o json` not honored (text only). |
| #4 | **Supervised Decisions Delete (first mutation)** | High | Medium-High | `cscli decisions delete -i/-r/--id` (flags verified). Only candidate that breaks the read-only invariant; needs confirmation + audit + auth discussion. Defer until read-only surface is flawless. |
| #5 | **Notifications plugin visibility (`cscli notifications list/inspect`)** | Low | Low-Medium | Real commands, but `notifications list -o json` **fails** with a JSON serialization error on this host; text-only. Low triage frequency. |

### 2.4 Selection rationale (#1)
- **Highest value × lowest cost:** a broken, user-facing, security-relevant
  path fixed by one logic line; no schema, capability, or frontend change.
- **Real signal:** open issue #1 with a matching, independently reproduced
  root cause — the plan is grounded, not speculative.
- **Read-only and lean:** touches nothing outside the existing envelope;
  no DB, no new probe, no new route.
- **It precedes #2 by priority:** shipping `explain` while a trivial existing
  feature reports wrong results would be the wrong ordering for an on-call
  triage tool.

### 2.5 Rejected / deferred candidates (brief)
- **AppSec inventory (`appsec-configs`/`appsec-rules`)** — *not needed as a new
  feature*: `cscli hub list -o json` already returns `appsec-configs`,
  `appsec-rules`, and `contexts` keys (verified: 7 top-level keys), and
  `Hub.tsx` renders every non-`ORDERED_TYPES` key via its fallback
  `orderedKeys` logic. No backend/frontend gap remains; do not add a page.
- **Notifications CRUD, `config show`, `console`/CAPI detail, `papi`,
  `support dump`** — niche or out-of-scope (setup/support/config excluded by
  workflow rules; notifications `-o json` broken).
- **Parser/scenario/WAF rule authoring** — crowdsec skill marks writing rules
  out of scope.
- **LDAP/OIDC/RBAC, multi-host, Postgres** — taste-rejected for single-admin.
- **CSV/bulk import-export, Prometheus/Grafana** — mutations or observability
  platform; excluded.

## 3. Proposed Architecture and Data/Control Flow

Single change, no new component. The `allowlists.check` handler already follows
the correct shape; only the text-signal extraction is wrong.

```
Browser ── GET /api/v1/allowlists/check/{ip} ──► FastAPI
   ├─ capability gate (allowlists.check supported?) → else unsupported (HTTP 200)
   ├─ CscliRunner.run(["allowlists","check", ip])
   ├─ non-zero exit / exec_missing / eacces / deadline → classify_failure
   │     → operation_error("allowlists.check", code)
   └─ exit 0 → decode stdout (lower) → matched = presence of "allowlisted"
        EXCLUDING the "not allowlisted" phrasing
        → success("allowlists.check", {"matched": bool})
```

**Contract fix** (logic only; do not change argv, envelope, or response shape):

- Treat as **matched** when the stdout, lower-cased, contains the "*is
  allowlisted*" phrasing while **not** containing `"not allowlisted"` /
  `"is not allowlisted"`.
- Concretely: `matched = "allowlisted" in text and "not allowlisted" not in text`.

This is robust to the two observed wordings and to the existing code's
`exit_code == 0` short-circuit (both matched and unmatched outputs exit 0).

## 4. Exact Files / Directories to Create and Modify

### Modified
- `backend/routers/allowlists/check.py` — replace the `matched = "found" in
  text` line with the marker logic in §3. Add a one-line comment noting the
  observed `cscli` wordings (`… is allowlisted by item …` vs `… is not
  allowlisted`) so the contract is self-documenting.
- `docs/operations-reference.md` — in the `allowlists.check` row, note the
  marker semantics (`matched == true` iff stdout reports the value as
  allowlisted) and correct any stale wording that implies a `"found"` match.

### Explicitly not created / modified
- No new router, envelope label, capability probe, frontend page/hook change,
  config key, or deploy artifact. `frontend/src/pages/Allowlists.tsx` and
  `frontend/src/hooks/useAllowlists.ts` are unchanged (`matched: boolean`
  contract already correct).

## 5. Interfaces, Schemas, Routes, Commands, Configuration Contracts

| Method | Path | Operation | Params | Success `result` | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/allowlists/check/{ip}` | `allowlists.check` | path `ip` | `{"matched": bool}` | **Unchanged shape**; only the boolean's correctness is repaired |

- **`cscli` argv (unchanged):** `["allowlists", "check", ip]`.
- **Envelope (unchanged):** success `{"operation":"allowlists.check",
  "result":{"matched":bool}}`; failures via `operation_error` with
  `unsupported`/`timeout`/`unavailable`/`permission_denied`/`crowdsec_failure`.
- **No config change.** No capability/probe change (`allowlists.check` already
  probed via Probe #1 structured-reads gate).
- **No frontend change** — `Allowlists.tsx` already maps `matched === true` →
  "Matched — exempt" and `false` → "Not matched".

## 6. Ordered Implementation Tasks

| # | Task | Files | Depends on |
|---|------|-------|------------|
| T1 | Correct the marker logic in the allowlists-check handler (per §3) and add the clarifying comment. | `backend/routers/allowlists/check.py` | — |
| T2 | Update the `allowlists.check` documentation row to state the corrected marker semantics. | `docs/operations-reference.md` | T1 |
| T3 | Manual verification against a live host with at least one populated allowlist (§7), including the known-present and known-absent IPs. | — | T1 |

Single-agent, sequential; total scope ≈ one logic line + one doc row + curl
checks. No parallelization needed.

## 7. Acceptance Criteria and Verification

### Backend — manual (from `backend/`, no pytest per lean scope)

```bash
# Boot with the real cscli (v1.7.8 present at /usr/bin/cscli)
cd backend && uv sync
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090 &

# 1. Present IP → matched:true  (123.30.108.100 is in vnh_ip on this host)
curl -s http://127.0.0.1:8090/api/v1/allowlists/check/123.30.108.100
# → {"operation":"allowlists.check","result":{"matched":true}}

# 2. Absent IP → matched:false
curl -s http://127.0.0.1:8090/api/v1/allowlists/check/8.8.8.8
# → {"operation":"allowlists.check","result":{"matched":false}}

# 3. Sanity: another absent IP
curl -s http://127.0.0.1:8090/api/v1/allowlists/check/1.2.3.4
# → {"operation":"allowlists.check","result":{"matched":false}}

# 4. Degraded/unsupported still intact (optional: rename /usr/bin/cscli, restart)
# → {"operation":"allowlists.check","error":{"code":"unsupported", ...}}

# 5. No stderr leak exit path unchanged
curl -s http://127.0.0.1:8090/api/v1/allowlists/check/8.8.8.8 | python3 -m json.tool
```

### Frontend — manual (regression, no code change)

```bash
cd frontend && npm install && npm run typecheck && npm run build   # green
# With the backend running: open /allowlists, enter 123.30.108.100 → "Matched — exempt";
# enter 8.8.8.8 → "Not matched". No console errors.
```

### Docs

```bash
grep -n "allowlists.check" docs/operations-reference.md
grep -n "matched" backend/routers/allowlists/check.py
```

## 8. Security, Compatibility, Migration, Operational Considerations

- **Security:** no argv change, no shell, no new input surface — `ip` is
  already positional and unquoted-shell-safe. The fix *increases* correctness
  (removes a false-negative that could mislead an operator into believing an
  IP is not exempt).
- **Compatibility:** response shape, operation label, error codes, capability
  map, and probe count are all unchanged — purely additive correction.
- **Migration:** none. Restart `uvicorn` only.
- **Operational:** no new log format, no new unit, no capacity change. No
  change to `deploy/`.

## 9. Risks, Unresolved Assumptions, Reviewer Ownership

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | `cscli allowlists check` output wording varies by version (e.g. different locale or "matches" vs "allowlisted") | Low | Medium | The chosen condition (`allowlisted` present AND `not allowlisted` absent) covers the two observed forms. Validate on target host (T3). |
| R2 | An allowlist entry value could contain the substring "allowlisted" (description text) | Very Low | Low | `-o` output prints the *value/comparison* line; `check` prints a single short verdict line, not the full entry table. If wording drifts, prefer exact `" is allowlisted"` / `" is not allowlisted"` markers (decision to validate on host — see A1). |

### Assumptions (explicit)
| # | Assumption | If wrong, plan changes |
|---|------------|------------------------|
| A1 | `cscli allowlists check` verb is "allowlisted" and negation is "not allowlisted" on the deployment hosts (verified on dev host, v1.7.8). | If other machines show different wording, use the `" is allowlisted"`/`" is not allowlisted"` exact-phrase check instead of the substring logic — still a one-line change in the same file. |

### Reviewer ownership
- **Primary:** `crowdsec-documentation-reviewer` (marker semantics + docs coherence).
- **Secondary:** `crowdsec-command-mapper` (no-shell / argv / error-code invariants remain intact).

## 10. Next feature candidates (for selection after #1)

1. **`explain` Live Log-Pipeline Debugger** — `GET /api/v1/explain?log=&type=`
   with a type allowlist + log-length cap; text/parse or raw `result`. Top
   *new* read-only capability (ranked #2).
2. **`version` system info** — `status.version` or a small Overview card.
3. **Supervised `decisions.delete`** — first mutation; needs auth + audit sign-off.
4. **`notifications` list/inspect** — text-only; JSON path is broken on this host.