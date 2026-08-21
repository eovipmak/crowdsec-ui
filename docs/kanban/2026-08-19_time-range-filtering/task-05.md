# Task 05 — Docs: wire contract (`docs/architecture.md` + `docs/operations-reference.md`)

## Objective

Sync the canonical wire contract to the new filtered-list behavior: extend `docs/architecture.md` and `docs/operations-reference.md` with `since`/`until`/`scenario_contains`/`offset` on `GET /api/v1/alerts` and `GET /api/v1/decisions`, strict unknown/duplicate → 400 validation, pass-through vs server-side `created_at` fallback, `cscli` argv mapping, `Cache-Control: no-store`, and unchanged probe/capability counts (still 6 probes, 16 probed ops, no new operation label).

## Prerequisites/dependencies

- Requires task-01 AND task-02 AND task-04 COMPLETED — docs must describe shipped behavior, not speculation. If alert/decision routers or pages have diverged from plan §5, STOP and report blocker — do not guess at query semantics.

## Owner / recommended agent profile

- Implementer: `crowdsec-documentation-reviewer`
- Reviewer: `crowdsec-command-mapper` (argv mapping audit)

## Exact files and artifacts to create or modify

- **MODIFY** `docs/architecture.md` — update the centralized operation/route table and probe/operation count notes.
- **MODIFY** `docs/operations-reference.md` — extend `GET /alerts` + `GET /decisions` tables, validation section, envelope examples, and `cscli` argv mapping.
- Do NOT create new doc files. Do NOT touch `backend/*`, `frontend/*`, or `deploy/*` beyond reading them for accuracy. Do not add CI, test, or observability docs.

## Concrete implementation steps

1. `docs/architecture.md`:
   - Update the probe summary: still 6 probes total (no new probe) — Probe #1 `["alerts","list","-o","json","-l","1"]` still covers `alerts.list` (now with `since`/`until`/`scenario_contains`/`offset` extensions), `decisions.list` likewise; keep 16 probed ops count (11 structured + `status.lapi` + `status.capi` + `metrics.show` + `hub.list` + `simulation.status`; `capabilities.list` meta).
   - Update the `| Method | Path | Operation | Notes |` table rows for:
     - `GET /api/v1/alerts` — list query params: `limit:int 1..100` (default 50), `scenario:string` exact, `ip:string` exact, `since:string` ISO-8601 or `N[smhd]` (optional), `until:string` (same), `scenario_contains:string 1..64` substring case-insensitive (optional), `offset:int 0..10000` (default 0); note strict query validation (unknown/duplicate → 400 `invalid_parameters` without spawn), `since`/`until` pass-through to `cscli --since/--until` when A1-supported else server-side `created_at` fallback, `scenario_contains`/`offset` server-side only, `Cache-Control: no-store`.
     - `GET /api/v1/decisions` — mirror (allowlist `{limit,type,ip,since,until,scenario_contains,offset}`, `type` is alias for `decision_type`).
   - Keep other rows unchanged (`alerts.inspect`, `decisions.check`, metrics/hub/simulation, health).

2. `docs/operations-reference.md`:
   - Extend the endpoints table rows for `GET /api/v1/alerts` and `GET /api/v1/decisions` with the same param list and success-result shape (still `Alert[]` / `Decision[]` flattened; filtered AND then `offset`-sliced).
   - Add/extend a validation subsection for both routes covering:
     - Allowlisted keys per route (alerts: `{limit,scenario,ip,since,until,scenario_contains,offset}`; decisions: `{limit,type,ip,since,until,scenario_contains,offset}`); any unknown key or duplicate key → 400 `invalid_parameters` without spawning `cscli` (before probe gate).
     - `limit` 1..100, `offset` 0..10000 int; `scenario_contains` 1..64 chars, no `\r\n\0`, no control chars; `since`/`until` 32-char cap, strict ISO-8601 or `N[smhd]` regex, no shell metachars, no leading `-`; `since` after `until` → 400.
     - `scenario` exact + `scenario_contains` substring may coexist (AND).
   - Document `cscli` argv mapping (per plan §5.3):
     - `GET /alerts` base `["alerts","list","-m","-l",str(limit_for_cscli),"-o","json"]` plus optional `["--since",since]`/`["--until",until]` when supported; `limit_for_cscli = min(100, limit+offset)` when `offset>0` else `limit`; `scenario_contains`/`offset` never in argv.
     - `GET /decisions` base `["decisions","list","-l",str(limit_for_cscli),"-o","json"]` plus `["-t",type]`/`["-i",ip]` plus same optional `["--since",since]`/`["--until",until]`.
   - Keep envelope examples (success 200 `{"operation":"alerts.list","result":[...]}` etc.) and add one 400 example for unknown key and one for `since=not-a-date`.
   - Note `Cache-Control: no-store` on success, `Content-Type: application/json; charset=utf-8`, stderr never returned.

3. Keep `docs/architecture.md` § Out of scope / § Response envelopes / § Config schema unchanged except for the two route row updates and any brief "pass-through vs fallback" note.

## Interfaces/contracts and integration points

- Wire contract is canonical in both docs; backend (tasks 01–02) is the source of truth for allowlists, validation, and argv pass-through vs fallback. Frontend (task-04) `datetime-local` → ISO-8601 conversion must match the documented `since`/`until` format.
- No `GET /api/v1/capabilities` change — still 16 entries.
- No new operation label, no new probe, no new config key.

## Acceptance criteria

- `docs/architecture.md` route table includes `since`/`until`/`scenario_contains`/`offset` on `GET /api/v1/alerts` and `GET /api/v1/decisions` with validation + `Cache-Control: no-store` notes; probe count still 6, probed ops still 16.
- `docs/operations-reference.md` endpoint table + validation subsection + `cscli` argv mapping + 400 envelope examples updated for both routes; unknown/duplicate → 400 without spawn is explicit.
- `grep -n "scenario_contains" docs/architecture.md docs/operations-reference.md` → hits in both docs.
- `grep -n "since.*until" docs/operations-reference.md` → time-range documented.
- `grep -n "GET.*/alerts" docs/operations-reference.md` and `grep -n "GET.*/decisions" docs/operations-reference.md` show the extended param lists.
- No backend or frontend file modified by this task.

## Verification commands/checks

From repo root:

- `grep -n "scenario_contains" docs/architecture.md docs/operations-reference.md` → non-empty.
- `grep -n "since.*until" docs/operations-reference.md` → non-empty.
- `grep -n "GET.*/alerts" docs/operations-reference.md` → updated row with `since/until/scenario_contains/offset`.
- `grep -n "GET.*/decisions" docs/operations-reference.md` → updated row with `type` + time-range + offset.
- `grep -n "16 probed" docs/architecture.md` (or `grep -n "probed ops" docs/architecture.md`) → still 16.
- Manual read: confirm argv mapping notes `limit_for_cscli = min(100, limit+offset)` and that `scenario_contains`/`offset` never enter argv.

## Reviewer

- `crowdsec-command-mapper` (argv mapping audit) — secondary `crowdsec-documentation-reviewer`.

## Explicit out-of-scope

- Any `backend/*` or `frontend/*` edit (tasks 01–04).
- New doc files, CI, tests, observability, Docker/K8s, auth, mutations.
- `config.yaml` / `deploy/config.example.yaml` changes (no new key).

## Coordinator status

- Status: completed
- Completed by: coordinator
- Completed at: 2026-08-21T00:00:00Z
- Verification: grep scenario_contains hits in both docs; grep since.*until non-empty; grep GET /alerts and GET /decisions show extended param lists; grep 16 probed ops still 16; manual read confirms limit_for_cscli = min(100, limit+offset) and scenario_contains/offset never in argv
- Commit or artifact reference: working tree (docs/architecture.md, docs/operations-reference.md)
