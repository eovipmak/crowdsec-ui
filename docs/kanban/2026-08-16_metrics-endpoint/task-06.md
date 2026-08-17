# Task 06 — Docs: `docs/architecture.md` + `docs/operations-reference.md`

## Objective

Update documentation to reflect the new `metrics.show` operation and `GET /api/v1/metrics[/{component}]` routes, keeping `docs/architecture.md` and `docs/operations-reference.md` coherent with the shipped wire contract, without introducing Prometheus/Grafana/auth scope.

## Prerequisites/dependencies

- task-03 COMPLETED (backend routes wired — final wire paths known: `GET /api/v1/metrics` + `GET /api/v1/metrics/{component}`) and task-05 COMPLETED (frontend `/metrics` route confirmed for the "frontend route table" doc line). If the API path or frontend route still differs from plan §5.1 at review time, STOP, report the blocker, do not guess the doc table from the plan alone; read `backend/main.py` + `frontend/src/App.tsx`.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper` or `crowdsec-documentation-reviewer`
- Reviewer: `crowdsec-documentation-reviewer` (primary) + `crowdsec-command-mapper` (argv/error-code taxonomy)

## Exact files and artifacts to create or modify

- **MODIFY** `docs/architecture.md` — add `metrics.show` to the Pieces diagram if touched, the config-schema stays slim note, the envelope operation list (now 14 ops + health), the capabilities probe table (add Probe #4), the route table, and remove `/metrics/{component}` from the "Out of scope (dropped)" list or mark it as revived (see current file's lines 113–127 dropped section).
- **MODIFY** `docs/operations-reference.md` — add endpoint rows for `GET /api/v1/metrics` and `GET /api/v1/metrics/{component}` per plan §5.1, including validation rules (14-type allowlist, unknown/duplicate query key → 400, case-sensitive, no alias), success envelope example, operation-level error rows, and a note distinguishing `GET /api/v1/metrics` (dashboard JSON) from Prometheus `/metrics` text exposition (not in scope).
- Optionally **TOUCH** `deploy/config.example.yaml` — add a commented note that metrics respects `cscli.timeout` (no new key). Not required; if the example file does not exist, skip without error.

Do NOT touch `backend/` or `frontend/` (tasks 01–05 own them). Do NOT create `docs/command-matrix.md`, Grafana dashboards, or Prometheus docs.

## Concrete implementation steps

1. Read `docs/architecture.md` (current state: 127 lines, § Pieces, cscli model, Config schema, Validation rules, Response envelopes with 10 codes, Static serving rules, Out of scope). Apply minimal surgical edits:
   - Add `metrics.show` to the envelope operations list (currently `capabilities.list, alerts.list … status.capi` — extend to include `metrics.show`).
   - Extend the capabilities probe description: add Probe #4 `["metrics","show","acquisition","-o","json"]` 5 s.
   - Extend the route table / operation summary to include `GET /api/v1/metrics` (all) and `GET /api/v1/metrics/{component}` (filtered, 14 canonical types).
   - In the "Out of scope (dropped)" section (lines 113–127), either delete the `"/metrics/{component} endpoint"` bullet or annotate it `— revived in 2026-08-16_metrics-endpoint`.
   - Do not introduce a Prometheus `/metrics` endpoint or suggest one; keep single-port (8090) and no-DB posture.
2. Read `docs/operations-reference.md` (shape: endpoint table + notes + error-code contract):
   - Add rows (mirroring existing `/alerts`, `/decisions`, etc. rows):
     `GET /api/v1/metrics` — operation `metrics.show`, no params, `result: Record<string, unknown>` (parsed `cscli metrics show -o json` object — keys are metric types), notes: full snapshot, `Cache-Control: no-store`.
     `GET /api/v1/metrics/{component}` — operation `metrics.show`, path param `component` ∈ 14 canonical types (`acquisition`, `alerts`, `appsec-engine`, `appsec-rule`, `bouncers`, `decisions`, `lapi`, `lapi-bouncer`, `lapi-decisions`, `lapi-machine`, `parsers`, `scenarios`, `stash`, `whitelists`), case-sensitive exact, aliases rejected → 400 `invalid_parameters`.
   - Document validation: unknown query key on `/metrics` → 400 `invalid_parameters`; duplicate query key → 400; invalid `component` → 400 without spawning cscli.
   - Include one success envelope example and one operation-level error envelope example (`crowdsec_failure` or `unsupported`), plus a request-level 400 example — reuse existing envelope examples style.
   - Add an explicit note: `GET /api/v1/metrics` is dashboard JSON, distinct from Prometheus text exposition `GET /metrics` (not in scope per taste § lean).
   - Do not invent new error codes — reuse the 10 codes already documented.
3. Optional: `deploy/config.example.yaml` — if present, add a commented note above `cscli.timeout` like `# governs metrics handlers and Probe #4`. Do not add a `metrics:` key.

## Interfaces/contracts and integration points

- Docs must match the shipped code: `backend/envelope.py:METRICS_SHOW == "metrics.show"`, `backend/capabilities.py` Probe #4 argv `["metrics","show","acquisition","-o","json"]` 5 s, `backend/routers/metrics/show.py:ALLOWLIST` 14 types, `backend/main.py` mount under `/api/v1/metrics`.
-Wire examples must show `Content-Type: application/json; charset=utf-8` + `Cache-Control: no-store`, `operation: "metrics.show"` with `result` as parsed JSON object, and `error: {code, message}` shapes per `backend/envelope.py` + `backend/errors.py`.
- Frontend `/metrics` client route must appear in the doc's frontend route mention if that table exists.

## Acceptance criteria

- `docs/architecture.md` mentions `metrics.show` in the operation list, shows Probe #4, and no longer lists `/metrics/{component}` as dropped without annotation.
- `docs/operations-reference.md` contains rows for `GET /api/v1/metrics` and `GET /api/v1/metrics/{component}`, documents the 14-type allowlist, 400 validation rules, and the dashboard-JSON vs Prometheus distinction note. No new error codes introduced; existing 10-code taxonomy intact.
- No doc references invent `engine/lapi/appsec` aliases as valid API inputs, no Prometheus `/metrics` text endpoint suggested as in-scope, no Docker/K8s or auth/session added.
- `grep -n "metrics.show" docs/architecture.md docs/operations-reference.md` hits in both files; `grep -n "GET.*/metrics" docs/operations-reference.md` hits both endpoint rows; `grep -rn "/api/v1/metrics" docs/ deploy/ 2>&1 | head` does not show drift.
- Docs are internally consistent with shipped code (allowlist + argv + envelope strings match).

## Verification commands/checks

From project root:

- `grep -n "metrics.show" docs/architecture.md docs/operations-reference.md` → both files match.
- `grep -n "GET.*/metrics" docs/operations-reference.md` → both endpoint rows present.
- `grep -rn "/api/v1/metrics" docs/ deploy/ 2>&1 | head` → only the intended docs rows, no stray Prometheus `/metrics` as endpoint.
- `grep -n "invalid_parameters\|unsupported\|malformed_output" docs/operations-reference.md` → error codes correctly reused.
- `grep -n "14\|acquisition" docs/operations-reference.md` → 14-type allowlist documented.
- `grep -n "Out of scope\|Dropped" docs/architecture.md` → dropped section no longer lists `/metrics/{component}` as unconditionally dropped.
- Optional: `grep -n "Prometheus\|Grafana" docs/architecture.md docs/operations-reference.md` → if present, only in the "not in scope" / distinction note.
- Visual: read the modified sections of both docs and confirm operation count is 14 (ops) and probe count is 4.

## Reviewer

- `crowdsec-documentation-reviewer` (primary — wire contract + envelope invariants + docs coherence)
- `crowdsec-command-mapper` secondary (allowlist + argv correctness in docs)

## Explicit out-of-scope

- Modifying any `backend/` or `frontend/` file (tasks 01–05).
- Creating `docs/command-matrix.md`, Prometheus exporters, Grafana dashboards, `/metrics` text exposition docs.
- Adding config keys (`config.yaml`, `backend/config.py`) or `cscli` flag docs (`--url`, `--no-unit`).
- Editing the source plan `docs/plans/2026-08-16_metrics-endpoint.md`.
- pytest / `backend/tests/` (none exist — D12).

## Coordinator status
- Status: completed
- Completed by: muse-spark-1.2-contributor
- Completed at: 2026-08-17T10:02:29Z
- Verification summary: prerequisites verified (backend/main.py imports metrics_router + api.include_router(metrics_router) under /api/v1 prefix; frontend/src/App.tsx has /metrics inside Layout; envelope.py METRICS_SHOW=="metrics.show", capabilities.py Probe #4 ["metrics","show","acquisition","-o","json"] 5s, show.py ALLOWLIST 14 types — all match plan); docs updated: architecture.md now 165 lines — 4 probes listed, 14 ops + health, route table with GET /api/v1/metrics + GET /api/v1/metrics/{component} and frontend /metrics, Dropped section revived in 2026-08-16_metrics-endpoint; operations-reference.md now 115 lines — endpoint rows for GET /api/v1/metrics and GET /api/v1/metrics/{component}, 14-type allowlist, validation (unknown/duplicate query key -> 400, invalid component -> 400 without spawning), success + operation_error + request 400 envelope examples, dashboard-JSON vs Prometheus distinction note; deploy/config.example.yaml commented note above cscli.timeout governing metrics and Probe #4, no metrics: key; verifications: grep metrics.show hits both files, grep GET.*metrics hits both rows, grep /api/v1/metrics shows only intended rows, error codes reused (invalid_parameters/unsupported/malformed_output), 14/acquisition present, Out of scope revived annotation present, Prometheus only in not-in-scope note, 10-code taxonomy and single-port 8090 no-DB posture preserved
- Commit reference: working tree (docs/architecture.md, docs/operations-reference.md, deploy/config.example.yaml) — HEAD 18e4378330d9a0848ab707df57b8377664c5a506 + 3 modified files (7 files in broader working tree incl. task-05 frontend changes pre-existing)
