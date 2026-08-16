# Task 07 — Migrate `decisions/*`, `machines/*`, `allowlists/*` routers (envelope + CscliRunner)

## Objective

Migrate the remaining prototype read routers to the new `CscliRunner.run` + `envelope.success/operation_error` pattern (plan §3.1): `decisions/{list,check}.py`, `machines/{list,inspect}.py`, `allowlists/{list,inspect,check}.py`. Same rules as task-06: never leak stderr, capabilities short-circuit, preserve existing transforms. **Special change for `allowlists/check`**: switch from `PlainTextResponse(raw_stdout)` to `envelope.success("allowlists.check", {"matched": <bool>})` per plan §5 #4.

## Prerequisites/dependencies

- task-01 COMPLETED (`envelope` + `errors`).
- task-02 COMPLETED (`CscliRunner` + `RunResult` + `classify_failure`).

## Owner / recommended agent profile

- Implementer: `crowdec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/routers/decisions/__init__.py`, `backend/routers/decisions/list.py`, `backend/routers/decisions/check.py`.
- **MODIFY** `backend/routers/machines/__init__.py`, `backend/routers/machines/list.py`, `backend/routers/machines/inspect.py`.
- **MODIFY** `backend/routers/allowlists/__init__.py`, `backend/routers/allowlists/list.py`, `backend/routers/allowlists/inspect.py`, `backend/routers/allowlists/check.py`.

Do NOT touch `backend/main.py` (task-04), `backend/routers/cscli.py` (task-02), `backend/capabilities.py`/`routers/capabilities.py` (task-03), `backend/routers/status.py` (task-05), `backend/routers/{alerts,bouncers}/*` (task-06).

## Concrete implementation steps

### 7.1 decisions/list.py
1. Migrate to `CscliRunner.run`, envelope, short-circuit, stderr-never-leak (pattern identical to task-06 §6.1).
2. Operation label `"decisions.list"`.
3. `argv = ["decisions","list","-l",str(limit),"-o","json"]`, optionally `+ (["-t", type_] if type_ else []) + (["-i", ip] if ip else [])` — keep the current prototype's argv-build logic.
4. Limits: `Query(50, ge=1, le=100)`. `type_` aliased to `type` (Python keyword safety); `ip` optional.
5. Preserve the current "first decision per alert" flatten transform.

### 7.2 decisions/check.py
6. Migrate to the new pattern. Operation label `"decisions.check"`.
7. KEEP path param `{ip}` (plan D14). Router prefix `/decisions/check` → final path `/api/v1/decisions/check/{ip}` (URL-encode the ip; FastAPI path params handle `%2F` issues via `%2F`-encoding, but ensure the ip doesn't contain a literal `/`-slash from the client — for IPv4/CIDR like `1.2.3.0/24` the client must percent-encode `/` as `%2F`; document this in `docs/operations-reference.md` (task-11)). cscli argv: `["decisions","list","-v",ip,"-o","json"]` — preserve.
8. Preserve the "all decisions flattened" transform.

### 7.3 machines/list.py
9. Migrate. Operation label `"machines.list"`. argv `["machines","list","-o","json"]`. Preserve field picking (`machineId→machine_id`, `ipAddress→ip_address`, `isValidated→validated`, etc.).

### 7.4 machines/inspect.py
10. Migrate. Operation label `"machines.inspect"`. argv `["machines","inspect",machine_id,"-o","json"]`. Preserve `pop("metrics")`/`pop("datasources")`. Not-found detection: exit_code≠0 + stderr-lowercase contains `"doesn't exist"`/`"not found"` → `operation_error("machines.inspect", NOT_FOUND)`. Never leak stderr.

### 7.5 allowlists/list.py
11. Migrate. Operation label `"allowlists.list"`. argv `["allowlists","list","-o","json"]`. Preserve `{name, description, created_at, updated_at, size: len(items)}` mapping.

### 7.6 allowlists/inspect.py
12. Migrate. Operation label `"allowlists.inspect"`. argv `["allowlists","list","-o","json"]` then linear-scan for `name` (preserve). On no match → `operation_error("allowlists.inspect", NOT_FOUND)` (this is technically a 404-class condition, but per plan §3.1 operation-level failures are HTTP 200 — return `operation_error` NOT `request_error(NOT_FOUND, 404)`. Confirm: plan §3.1 op-failure is 200; the not-found here is "cscli succeeded but the entry wasn't in the list" — returns as an op-error envelope with code... hmm, plan §3.2 op-level codes don't include `not_found`. Decision: return `operation_error("allowlists.inspect", UNSUPPORTED)` is wrong; correct is to surface a request-level 404 — but to stay envelope-consistent, return `operation_error(op, CROWDSEC_FAILURE, msg="Allowlist not found")`. Pick this; document inline.)

### 7.7 allowlists/check.py ★ SPECIAL
13. **CHANGE**: replace the current `return PlainTextResponse(run_cscli(...).decode().strip())` with:
    ```python
    argv = ["allowlists","check",ip]   # NO -o json (human output, per plan §5 #4)
    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        return operation_error("allowlists.check", classify_failure(result))
    text = result.stdout.decode(errors="replace").lower()
    matched = "found" in text
    return success("allowlists.check", {"matched": matched})
    ```
14. KEEP path param `{ip}` (plan D14).
15. Prefix `/allowlists/check` → final `/api/v1/allowlists/check/{ip}`. Same `%2F` note as §7.2 for CIDR inputs.

### 7.8 Package __init__.py exports
16. Update the three `__init__.py` files to export the (renamed) router symbols consistently: `from .list import list_router`, `from .inspect import inspect_router` (where present), `from .check import check_router`.
   - `routers/decisions/__init__.py`: export `list_router`, `check_router` (no inspect).
   - `routers/machines/__init__.py`: export `list_router`, `inspect_router`.
   - `routers/allowlists/__init__.py`: export `list_router`, `inspect_router`, `check_router`.

## Interfaces/contracts and integration points

- All seven migrated routers consumed by task-04 via `app.include_router(api)` under `/api/v1`.
- The `allowlists/check` field `{"matched": bool}` MUST match the frontend (task-09 `types.ts`).
- The "first-decision-per-alert" flatten shape of `/decisions` MUST stay byte-identical (frontend depends on it).
- `app.state.runner` + `app.state.capabilities` from task-04 lifespan.

## Acceptance criteria

- `from routers.decisions import list_router, check_router`; `from routers.machines import list_router, inspect_router`; `from routers.allowlists import list_router, inspect_router, check_router` all import cleanly post-migration.
- `GET /api/v1/decisions/check/1.2.3.4` → `{operation:"decisions.check", result:[...]}` on success; op-error envelope on failure.
- `GET /api/v1/allowlists/check/1.2.3.4` → `{operation:"allowlists.check", result:{"matched":<bool>}}` (NOT PlainTextResponse).
- `GET /api/v1/machines/inspect/nonexistent` → op-error with code matching the not-found signal (per §7.4 design; verify no stdout leak).
- None of the migrated router modules make use of the legacy `run_cscli(*args)` helper (they all call `CscliRunner.run`).
- `grep -nE 'detail=.*stderr|return.*stderr\.decode|PlainTextResponse' backend/routers/{decisions,machines,allowlists}/*` → only allowed match is the removed `PlainTextResponse` import being deleted (verify it's gone from `allowlists/check.py`).

## Verification commands/checks

From `backend/` after task-04 lands:
- `uv run python -c "from routers.decisions import list_router, check_router; from routers.machines import list_router as m, inspect_router as mi; from routers.allowlists import list_router as a, inspect_router as ai, check_router as ac; print('imports OK')"`.
- Boot uvicorn, curl each migrated route, check envelope shape + no-stderr in body.
- `grep -rnE 'detail=.*stderr|run_cscli' backend/routers/{decisions,machines,allowlists}/` → no matches (every handler migrated; legacy leak-stderr gone).
- `grep -nE 'PlainTextResponse' backend/routers/allowlists/check.py` → no matches.

## Explicit out-of-scope

- Editing `backend/main.py` (task-04).
- Migrating alerts/bouncers routers (task-06).
- Frontend (tasks 09/10).
- Tests/pytest (D12).
- Editing the source plan.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper (via coordinator)
- Completed at: 2026-08-16T00:00:00Z
- Verification: All 7 routers import cleanly; `grep -rnE 'detail=.*stderr|return.*stderr\.decode|PlainTextResponse'` → no matches; `grep -rnE 'HTTPException'` → no matches; `grep -rnE 'run_cscli'` → no matches; allowlists/check switched from PlainTextResponse to envelope `{"matched": bool}`
- Commit or artifact reference: working tree
