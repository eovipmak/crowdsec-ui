# Task 06 — Docs for `simulation.status` (`docs/architecture.md` + `docs/operations-reference.md`)

## Objective

Update the canonical docs so the wire contract, probe table, route table, and out-of-scope notes reflect the new `simulation.status` operation and `GET /api/v1/simulation` endpoint. This is the close-out doc sync after tasks 01–05 have shipped the backend + frontend.

## Prerequisites/dependencies

- task-03 COMPLETED — requires final API route `GET /api/v1/simulation` and capability count 16 confirmed (so docs match reality).
- task-05 COMPLETED — requires frontend banner placement confirmed (Overview + Decisions, no new route/nav) so docs describe the correct SPA surface.
- `docs/architecture.md` and `docs/operations-reference.md` at post-`2026-08-17` state (hub + drilldown already documented).

## Owner / recommended agent profile

- Implementer: `crowdsec-documentation-reviewer`
- Reviewer: `crowdsec-command-mapper` (secondary for probe/argv accuracy)

## Exact files and artifacts to create or modify

- **MODIFY** `docs/architecture.md` — add `simulation.status` to operation list, extend probe table (6 probes), update route table, add simulation notes, remove from out-of-scope if listed.
- **MODIFY** `docs/operations-reference.md` — add endpoint row per §5.1, extend envelope examples, add simulation payload notes and Cache-Control headers.

Do NOT touch `backend/*` (tasks 01–03) or `frontend/*` (tasks 04–05) except to verify doc claims.

## Concrete implementation steps

1. `docs/architecture.md`:
   - **Operation list** (envelope section): extend from 15 probed ops to 16 — add `simulation.status` alongside `metrics.show` and `hub.list` (now: 11 structured reads + `status.lapi` + `status.capi` + `metrics.show` + `hub.list` + `simulation.status` = 16). Update count and label list.
   - **Probe table** (capabilities section): add Probe #6 row — `["simulation","status"]` → `simulation.status`, 5s probe, text check for `"simulation"` substring, governed by `cscli.timeout` via `CscliRunner.default_timeout`.
   - **Route table**: add row `GET /api/v1/simulation | simulation.status | — (any query key → 400) | {global: bool, scenarios: string[], raw: string}` with `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8`. Note query rejection (any query key or duplicate → 400 without spawn).
   - **SPA routes**: note `/overview` and `/decisions` now show simulation banner/callout when `simulation.status` is active (no new `/simulation` SPA route — banner-only).
   - **Out of scope**: ensure `simulation enable/disable` writes remain listed as out of scope / mutations.

2. `docs/operations-reference.md`:
   - **Endpoints table**: add row for `GET /api/v1/simulation` with Method/Path/Operation/Params/Success-result shape columns per existing style.
   - **Validation rules** subsection: document query rejection — unknown query key → 400 `invalid_parameters` without spawning; duplicate query key → 400.
   - **`cscli` argv table**: add row `GET /simulation → ["simulation","status"]` with timeout from `cscli.timeout` / `CscliRunner.default_timeout` (Probe #6 uses 5s fixed).
   - **Envelope examples**: add Success example:
     ```json
     { "operation": "simulation.status", "result": { "global": false, "scenarios": [], "raw": "global simulation: disabled\n..." } }
     ```
     and Operation-level error examples (`unsupported`, `crowdsec_failure`, `timeout`) plus Request-level 400 example.
   - **Hub/metrics style notes**: add **Simulation** subsection mirroring Hub inventory notes — describe text parse, `global` vs per-scenario, `raw` fallback, SPA banner locations, degraded `unsupported` behavior, and that `simulation enable/disable` are not proxied (read-only `status` only).
   - Ensure all responses note `Cache-Control: no-store` and `Content-Type: application/json; charset=utf-8` for simulation.

3. Do NOT add `deploy/config.example.yaml` changes (no new YAML key — comment optional but not required). Do NOT create `docs/command-matrix.md`.

4. Verify doc links: cross-reference `docs/architecture.md` ↔ `docs/operations-reference.md` still consistent on operation count (16), probe count (6), and route count.

## Interfaces/contracts and integration points

- Doc source of truth: `backend/envelope.py:SIMULATION_STATUS`, `backend/capabilities.py` Probe #6, `backend/routers/simulation/status.py` router contract — docs must mirror those exactly.
- Frontend surface: `frontend/src/pages/Overview.tsx` banner + `frontend/src/pages/Decisions.tsx` callout — docs must describe banner-only, not a dedicated page.
- Existing docs: `docs/architecture.md` is the canonical wire contract for reviewers; `docs/operations-reference.md` is the frontend team's API reference — both must agree on envelope, error codes, headers, and probe semantics.

## Acceptance criteria

- `grep -n "simulation.status" docs/architecture.md docs/operations-reference.md` shows entries in both files (operation list, probe table, route table, endpoint table, envelope examples).
- `grep -n "GET.*/simulation" docs/operations-reference.md` shows the endpoint row.
- `grep -n "Probe #6" docs/architecture.md` shows the new probe row with `simulation status` and 5s timeout.
- Route table in `docs/architecture.md` lists `GET /api/v1/simulation` with `simulation.status` and notes query rejection + `no-store`.
- `docs/operations-reference.md` has a simulation subsection with success/error envelope examples and `Cache-Control: no-store` noted.
- Operation count in docs is 16 probed ops (plus `capabilities.list` meta-op, plus raw `health`) — consistent across both files.
- No doc references `simulation enable/disable` as in-scope; mutations remain out of scope.
- `grep -rn "/api/v1/simulation" docs/ deploy/ 2>&1 | head` shows docs entries; no `deploy/*` code change needed.

## Verification commands/checks

From repo root:

- `grep -n "simulation.status" docs/architecture.md docs/operations-reference.md` → entries in both.
- `grep -n "Probe #6" docs/architecture.md` → probe row present.
- `grep -n "GET.*/simulation" docs/operations-reference.md` → endpoint row present.
- `grep -n "Cache-Control.*no-store" docs/operations-reference.md` → simulation row notes no-store.
- `grep -rn "simulation" docs/architecture.md docs/operations-reference.md | head -n 20` → count and probe notes consistent.
- Optional: `grep -n "simulation" docs/plans/2026-08-18_feature-research-and-next-candidates.md` → plan and docs agree on operation label and banner placement.

## Reviewer

- `crowdsec-documentation-reviewer` (primary — wire contract, envelope invariants, docs coherence)
- Secondary: `crowdsec-command-mapper` for probe/argv accuracy.

## Explicit out-of-scope

- Modifying any `backend/*` file (tasks 01–03) — docs mirror, don't rewrite, the implementation.
- Modifying any `frontend/*` file (tasks 04–05) — banner implementation is already done.
- Creating `backend/tests/`, Prometheus exporters, Grafana dashboards, `docs/command-matrix.md`, auth/session files, new systemd units.
- Adding a new YAML key to `config.yaml` or `deploy/config.example.yaml` — simulation reuses `cscli.timeout`.
- Mutations (`simulation enable/disable`) — read-only `status` only.

## Coordinator status
- Status: completed
- Completed by: crowdsec-documentation-reviewer
- Completed at: 2026-08-18T00:00:00Z
- Verification: grep -n "simulation.status" in both docs (architecture.md lines 47/94/97/101/124/127/128; operations-reference.md lines 21/38/122-168); Probe #6 present; GET /api/v1/simulation endpoint row present; Cache-Control no-store noted; operation count = 16 probed ops consistent across both files; mutations remain out of scope
- Commit or artifact reference: working tree

