# Task 11 — Deploy artifacts + docs (slim schema)

## Objective

Land the deploy artifacts + docs per plan §8 Phase 7 (slimmed for the revised scope): `backend/build.sh` (uv sync + npm build — NO pytest), `deploy/crowdsec-dashboard.service` (uvicorn ExecStart; hardened systemd), `deploy/config.example.yaml` (slim schema — `server`/`cscli`/`logging` only), `deploy/install/README.md`, root `config.yaml` (dev defaults + comments), `docs/architecture.md`, `docs/operations-reference.md`. No references to `docs/command-matrix.md` (D11 — does not exist). No references to dropped endpoints (auth/session/metrics/mutations).

## Prerequisites/dependencies

- task-04 COMPLETED (the `uvicorn main:app` exec line + config schema reference).
- task-08 COMPLETED (static serving; the systemd unit needs `frontend/dist/` to exist for `curl /` to work; acceptable for the install README to instruct the operator to run `backend/build.sh` first).
- task-10 COMPLETED (frontend `dist/` exists for backend integration smoke).

## Owner / recommended agent profile

- Implementer: `native-deployment-operator`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `backend/build.sh` (executable; `set -euo pipefail`).
- **CREATE** `deploy/crowdsec-dashboard.service`.
- **CREATE** `deploy/config.example.yaml`.
- **CREATE** `deploy/install/README.md`.
- **CREATE/MODIFY** root `config.yaml` (repo-root dev-friendly example).
- **CREATE** `docs/architecture.md`.
- **CREATE** `docs/operations-reference.md`.

DELETE the stale `docs/kanban/2026-08-15_fastapi-rebuild/task-12.md` and `task-13.md` (already replaced by the rewritten kanban `README.md` + `task-01..11`; the prior task-12/13 referenced Go cleanup + command-matrix docs — both moot per plan §11).

Do NOT touch `backend/app/**`/`backend/main.py`/`backend/routers/**`/`backend/*.py` or `frontend/src/**`.

## Concrete implementation steps

1. `backend/build.sh`:
   ```sh
   #!/usr/bin/env bash
   set -euo pipefail
   cd "$(dirname "$0")/.."
   echo "[1/2] Syncing backend deps..."
   (cd backend && uv sync --frozen 2>/dev/null || uv sync)
   echo "[2/2] Building frontend..."
   (cd frontend && npm ci && npm run build)
   test -f frontend/dist/index.html
   echo "Build OK. Run the service with:"
   echo "  (cd backend && DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090)"
   ```
   (NOTE: no pytest step — plan D12.)
2. `deploy/crowdsec-dashboard.service`:
   ```ini
   [Unit]
   Description=CrowdSec Dashboard (FastAPI + Vite SPA)
   After=network-online.target crowdsec.service
   Wants=network-online.target

   [Service]
   Type=simple
   User=crowdsec-dashboard
   Group=crowdsec-dashboard
   WorkingDirectory=/opt/crowdsec-dashboard/backend
   Environment=DASHBOARD_CONFIG=/etc/crowdsec-dashboard/config.yaml
   ExecStart=/usr/bin/env uv run uvicorn main:app --host 127.0.0.1 --port 8090
   Restart=on-failure
   RestartSec=2s
   NoNewPrivileges=yes
   ProtectSystem=strict
   ProtectHome=yes
   PrivateTmp=yes
   ReadWritePaths=/var/lib/crowdsec-dashboard
   CapabilityBoundingSet=
   AmbientCapabilities=

   [Install]
   WantedBy=multi-user.target
   ```
   (Bind to loopback only; if the operator needs a NIC IP, they edit the ExecStart `--host` line + systemd unit; document in install README.)
3. `deploy/config.example.yaml` (slim schema per plan §8):
   ```yaml
   # CrowdSec Dashboard configuration — run `htpasswd`/etc. is NOT needed (login deferred).
   # Schema documented at docs/architecture.md.

   server:
     bind: 127.0.0.1            # NOT 0.0.0.0 (forces loopback or NIC IP — never wildcard)
     port: 8090                 # NOT 8080 (reserved for CrowdSec LAPI)
     static_dir: ../frontend/dist  # path to the built SPA; default <repo>/frontend/dist

   cscli:
     executable_path: /usr/bin/cscli  # optional; falls back to /usr/local/bin/cscli or /opt/crowdsec/bin/cscli
     timeout: 30s               # 1s..120s

   logging:
     level: info                # debug|info|warn|error
     format: text               # text|json
     output: stderr             # stderr|stdout|<file path>
   ```
4. `deploy/install/README.md`:
   - **Prerequisites**: uv (Astral) installed; Node 18+ or 20+ (for the Vite build); CrowdSec 1.7.8+ with `cscli` locally executable by the `crowdsec-dashboard` user.
   - **Build**: `git clone`, `bash backend/build.sh` (this `uv sync` + `npm ci && npm run build`).
   - **Place config**: `sudo install -d /etc/crowdsec-dashboard && sudo cp deploy/config.example.yaml /etc/crowdsec-dashboard/config.yaml && sudo $EDITOR /etc/crowdsec-dashboard/config.yaml`. Adjust `server.bind`/`port`, `cscli.executable_path` if needed.
   - **Install systemd unit**: `sudo install -d /opt/crowdsec-dashboard && sudo rsync -a backend frontend /opt/crowdsec-dashboard/` (or symlink to the repo); `sudo cp deploy/crowdsec-dashboard.service /etc/systemd/system/`; `sudo systemctl daemon-reload && sudo systemctl enable --now crowdsec-dashboard`.
   - **Verify**: `curl http://127.0.0.1:8090/api/v1/health` → `{"status":"ok"}`; `curl http://127.0.0.1:8090/` → the SPA HTML.
   - **Start/Stop/Restart**: `sudo systemctl {start,stop,restart} crowdsec-dashboard`; status: `systemctl status crowdsec-dashboard`.
   - **Update**: `cd /opt/crowdsec-dashboard && git pull && bash backend/build.sh && sudo systemctl restart crowdsec-dashboard`.
   - **Troubleshooting**:
     - `curl /api/v1/health` returns 404 or SPA HTML → check that `backend/main.py` boots; `journalctl -u crowdsec-dashboard -n 50`.
     - `cscli executable not found` in logs → check `cscli.executable_path` and that the `crowdsec-dashboard` user can exec the binary; if `executable_path` not set, the backend searches `/usr/bin/cscli`, `/usr/local/bin/cscli`, `/opt/crowdsec/bin/cscli`.
     - Port 8080 rejected at startup → reserved for CrowdSec LAPI; use 8090 (default) or another free port.
     - `0.0.0.0` rejected at startup → bind to a NIC IP or loopback (127.0.0.1).
     - `/capabilities` shows all ops `unsupported` → the startup probe failed; check `journalctl` for cscli invocation errors.
5. Root `config.yaml` (dev-friendly defaults):
   ```yaml
   server:
     bind: 127.0.0.1
     port: 8090
     static_dir: ../frontend/dist
   cscli:
     # executable_path: omitted → backend probes /usr/bin/cscli, /usr/local/bin/cscli, /opt/crowdsec/bin/cscli
     timeout: 30s
   logging:
     level: info
     format: text
     output: stderr
   ```
6. `docs/architecture.md`:
   - Goal + two pieces (FastAPI backend + Vite SPA) on one port.
   - Diagram (ASCII or mermaid): Browser ⇄ (FastAPI: `/api/v1/*` + static `/`) ⇄ cscli subprocess ⇄ CrowdSec LAPI/DB. No app DB. No shell.
   - cscli execution model (asyncio exec, positional argv, no shell, executable path from config or bootstrap fallback list, per-command timeout, capability probes cached at startup).
   - Config schema (slim: server/cscli/logging); validation rules (bind ≠ 0.0.0.0, port ≠ 8080, timeout 1s..120s).
   - Envelope (minimal `{operation, result}` / `{operation, error}` / `{error}` — no `source.command`, no `page`).
   - Static serving rules per plan §6 + the SPA-fallback-200 decision.
   - Out-of-scope section: explicitly note auth/session/mutations/metrics/command-matrix/pytest as DROPPED (link to plan §11).
7. `docs/operations-reference.md`:
   - Table per endpoint: method, path, params, success-result shape, the operation label surfaced in `success.operation`.
   - 15 rows matching plan §3.3 (health, capabilities, alerts list+inspect, decisions list+check, machines list+inspect, bouncers list+inspect, allowlists list+inspect+check, status/lapi, status/capi).
   - Note: `/decisions/check/{ip}` and `/allowlists/check/{ip}` REQUIRE percent-encoding `/` as `%2F` for CIDR inputs.
   - Note: `allowlists.check` returns `{matched: bool}` ("found" substring in stdout), no JSON.
   - Note: `status.lapi` returns `{healthy: bool}` ("successfully interact" substring); `status.capi` returns `{enabled: bool}` (non-empty stdout).
   - List the 8 error codes (4 request-level + 6 operation-level per plan §3.2 — actually 4+6=10; the actual table has 10 codes — the assignment of which are 4xx vs 200-time is shown in plan §3.2).
   - Cross-reference `docs/architecture.md`, NOT `docs/command-matrix.md` (does not exist — D11).
8. Delete `docs/kanban/2026-08-15_fastapi-rebuild/task-12.md` and `task-13.md` (rewritten board does not carry these forward).
9. Cross-check pass:
   - Root `config.yaml` schema keys match `deploy/config.example.yaml` match `backend/config.py` (task-01).
   - No doc references `/session`, `/metrics`, mutations, `docs/command-matrix.md`, `backend/internal/`, `backend/cmd/`, `backend/go.mod`, `frontend/src/app/` (Next.js).
   - `backend/build.sh` runs green end-to-end (see Verification).

## Interfaces/contracts and integration points

- `backend/build.sh` is the operator-facing build entry; the install README tells the operator to run it.
- The systemd unit's `ExecStart=uv run uvicorn main:app --host 127.0.0.1 --port 8090` references `backend/main.py:app` via the working directory `/opt/crowdsec-dashboard/backend`.
- `deploy/config.example.yaml` schema MUST mirror `backend/config.py`'s `Config` model exactly (task-01 validator will reject bind 0.0.0.0 / port 8080 / bad timeout; documented in the example comments).
- `docs/operations-reference.md` is the frontend team's API reference.

## Acceptance criteria

- `backend/build.sh` is executable (`-rwxr-xr-x`) and runs green end-to-end; `frontend/dist/index.html` exists after.
- `deploy/crowdsec-dashboard.service` exists; `systemd-analyze verify` (if available) shows no serious findings.
- `deploy/config.example.yaml` and root `config.yaml` use only keys in the slim schema (server/cscli/logging); the only top-level keys present match `backend/config.py`.
- `docs/architecture.md` and `docs/operations-reference.md` exist and cover the items listed above.
- No doc references any dropped path/concept: `/session`, `/metrics`, mutations, `docs/command-matrix.md`, Go paths, Next.js paths.
- `grep -rn 'session\.ttl\|admin_password_hash\|auth\.session\|/api/v1/metrics\|command-matrix' docs/ deploy/ config.yaml README.md` (when README exists) → no matches in the doc set.
- Prior `task-12.md`/`task-13.md` deleted from `docs/kanban/2026-08-15_fastapi-rebuild/`.

## Verification commands/checks

From repo root:
- `bash backend/build.sh` → exits 0; `test -f frontend/dist/index.html` true.
- `systemd-analyze verify deploy/crowdsec-dashboard.service` → no "Error" lines (warnings about `User=` allowed only if `crowdsec-dashboard` user doesn't exist in dev; record "NA — user not present" honestly if so).
- `grep -nE 'admin_password_hash|session\.ttl' deploy/config.example.yaml config.yaml` → no matches.
- `grep -rn '/api/v1/session\|/api/v1/metrics\|/docs/command-matrix\.md\|backend/internal/\|backend/cmd/' docs/ deploy/` → no matches.
- `ls docs/architecture.md docs/operations-reference.md` → both exist.
- `ls docs/kanban/2026-08-15_fastapi-rebuild/` → contains `README.md`, `task-01.md` … `task-11.md`; NO `task-12.md` or `task-13.md`.

## Explicit out-of-scope

- Docker/Podman/Kubernetes packaging (unchanged from prior plan).
- CI/CD pipelines.
- Editing `backend/app/**`/`backend/main.py`/`backend/routers/**`/`backend/*.py` (tasks 01–08 own those).
- Editing `frontend/src/**` (tasks 09/10).
- Editing `backend/pyproject.toml` (task-01).
- Editing the source plan `docs/plans/2026-08-15_fastapi-rebuild.md` — that's the rewrite_vault's job (the user).
- Tests/pytest (D12 — `backend/build.sh` does NOT run pytest).

## Coordinator status
- Status: completed
- Completed by: native-deployment-operator (via coordinator)
- Completed at: 2026-08-16T13:30:00Z
- Verification: All 7 deliverables present (`backend/build.sh`, `deploy/crowdsec-dashboard.service`, `deploy/config.example.yaml`, `deploy/install/README.md`, root `config.yaml`, `docs/architecture.md`, `docs/operations-reference.md`); `test -x backend/build.sh` → exec-bit OK; `head -1 backend/build.sh` → `#!/usr/bin/env bash`; `head -1 deploy/crowdsec-dashboard.service` → `[Unit]`; `bash backend/build.sh` → exit 0 (uv sync + npm ci + vite build; 1723 modules; dist/index.html + assets present); `systemd-analyze verify deploy/crowdsec-dashboard.service` → exit 0 (no errors, no warnings); `grep -nE 'admin_password_hash|session\.ttl|auth\.session|/api/v1/session|/api/v1/metrics' deploy/config.example.yaml config.yaml` → no matches; `grep -rnE '/api/v1/session|/api/v1/metrics|/docs/command-matrix\.md|backend/internal/|backend/cmd/|backend/go\.mod|frontend/src/app/' docs/architecture.md docs/operations-reference.md deploy/ config.yaml` → no matches; `grep -rnE 'next/|from "axios"|useMutation|X-CSRF-Token' docs/architecture.md docs/operations-reference.md deploy/ config.yaml` → no matches; `grep -E '^[a-z_]+:' deploy/config.example.yaml config.yaml` → only `server:`/`cscli:`/`logging:` (slim schema); `docs/operations-reference.md` endpoint table has 15 rows + error-code table has all 10 codes (4 request-level + 6 operation-level) with verbatim safe messages; `docs/architecture.md` has required sections (Goal/Pieces/cscli execution model/Config schema/Validation rules/Response envelopes/Static serving rules/Out of scope citing plan §11); step 8 stale task-12/13 deletion confirmed no-op (files already absent, verified with `ls docs/kanban/2026-08-15_fastapi-rebuild/`); end-to-end integration boot with new root `config.yaml`: `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --port 8090` boots cleanly, `curl /api/v1/health` → 200 `{"status":"ok"}`, `curl /` → 200 `text/html` + `cache-control: no-store` (task-04 lifespan + task-08 static + task-10 dist all assembled), `curl /api/v1/status/lapi` → `{"operation":"status.lapi","result":{"healthy":true}}`
- Commit or artifact reference: working tree
