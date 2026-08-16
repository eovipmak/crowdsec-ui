# Install — CrowdSec Dashboard (PM2-managed, cross-platform)

This document covers a native deployment of the CrowdSec Dashboard (FastAPI
backend + Vite SPA, single port `:8090`) under **PM2** instead of `systemd`.

PM2 keeps the same runtime on Linux, macOS, and Windows — the only platform-
specific step is the OS auto-start hook (documented below).

## Prerequisites

- **Node.js 18+/20+** and **PM2** installed globally: `npm i -g pm2`
  (PM2 is the process manager AND the build orchestrator — no separate
  `build.sh` or systemd unit).
- **uv** (Astral) installed and on `PATH` — used by the backend at build and
  run time (`uv sync`, `uv run uvicorn`).
- **CrowdSec 1.7.8+** with `cscli` executable by the OS user that owns the
  PM2 process (the backend shells out to `cscli` as an asyncio subprocess).

## Build

The PM2 ecosystem file `deploy/ecosystem.config.cjs` declares a one-shot
`build` app for you — no separate `bash build.sh` needed:

```sh
git clone <your-repo> crowdsec-dashboard && cd crowdsec-dashboard
pm2 start deploy/ecosystem.config.cjs --only crowdsec-dashboard-build
pm2 logs crowdsec-dashboard-build   # wait for "✓ built in NNs" then the app exits to `stopped`
```

The build app runs `uv sync` (backend deps) and `npm ci && npm run build`
(frontend, producing `frontend/dist/`). It does **not** run tests. PM2 exits
the app's status to `stopped` on success (exit 0) or `errored` on failure.
A first-time build (cold `npm ci`) takes ~15–25s; wait for the `✓ built in NNs`
line before starting the dashboard.

## Place config

```sh
mkdir -p /etc/crowdsec-dashboard
cp deploy/config.example.yaml /etc/crowdsec-dashboard/config.yaml
$EDITOR /etc/crowdsec-dashboard/config.yaml
```

Adjust as needed:

- `server.bind` / `server.port` — to bind a NIC IP, set `server.bind` to that
  IP AND override the PM2 `--host` flag (see **Customise the bind** below).
  Default is loopback only. Port must not be `8080` (reserved for CrowdSec LAPI).
- `cscli.executable_path` — set explicitly, or leave unset so the backend
  probes `/usr/bin/cscli`, `/usr/local/bin/cscli`, `/opt/crowdsec/bin/cscli`.

If your config lives outside the default `../config.yaml` (repo root from
`backend/`), tell PM2 where it is via the env var the backend already reads:

```sh
DASHBOARD_CONFIG=/etc/crowdsec-dashboard/config.yaml pm2 start deploy/ecosystem.config.cjs --only crowdsec-dashboard --update-env
# or persist it across restarts:
DASHBOARD_CONFIG=/etc/crowdsec-dashboard/config.yaml pm2 restart crowdsec-dashboard --update-env
```

## Run the server

```sh
pm2 start deploy/ecosystem.config.cjs --only crowdsec-dashboard
```

The `dashboard` app runs `uv run uvicorn main:app --host 127.0.0.1 --port 8090`
with `cwd: backend/`. Logs go to `logs/dashboard-out.log` and `logs/dashboard-err.log`.

## Verify

```sh
curl http://127.0.0.1:8090/api/v1/health   # → {"status":"ok"}
curl http://127.0.0.1:8090/                # → the SPA HTML
```

## Operate

```sh
pm2 status                           # see both apps + status
pm2 logs crowdsec-dashboard          # live tail (Ctrl-C to detach)
pm2 restart crowdsec-dashboard          # apply code changes (no rebuild)
pm2 restart crowdsec-dashboard-build # rebuild assets after `git pull`
pm2 stop crowdsec-dashboard          # stop the server
pm2 delete crowdsec-dashboard        # remove the app from PM2's list
```

The `logs/` directory is created in the repo root on first run (the
ecosystem file writes to `<repo-root>/logs/{build,dashboard}-{out,err}.log`).

## OS auto-start (operator's responsibility)

PM2 is cross-platform but boot-time auto-start is OS-specific. The dashboard
ships **no** boot script — configure the one matching your OS:

- **Linux (systemd):** `pm2 startup systemd && pm2 save`
- **macOS (launchd):** `pm2 startup launchd && pm2 save`
- **Windows:** install [`pm2-windows-startup`](https://www.npmjs.com/package/pm2-windows-startup)
  (or [`pm2-installer`](https://github.com/jessety/pm2-installer)),
  then `pm2 save`.

`pm2 save` snapshots the running process list so the auto-start script can
restore it on boot. After you change which apps PM2 manages, re-run `pm2 save`.

## Customise the bind (loopback → NIC IP)

The ecosystem file bakes `--host 127.0.0.1` into the `dashboard` app's args.
To listen on a NIC IP across PM2 restarts, edit `deploy/ecosystem.config.cjs`
**and** `config.yaml`'s `server.bind` to the same IP (the config validator
rejects `0.0.0.0`). Quick ad-hoc override (one launch only):

```sh
pm2 delete crowdsec-dashboard
pm2 start deploy/ecosystem.config.cjs --only crowdsec-dashboard \
  --node-args="--host 192.168.1.10"
```

## Update

```sh
cd /path/to/crowdsec-dashboard && git pull
pm2 restart crowdsec-dashboard-build  # rebuild frontend assets
pm2 restart crowdsec-dashboard         # restart the server with new code
```

## Troubleshooting

- `curl /api/v1/health` returns 404 or SPA HTML → the backend likely failed
  to boot; inspect `pm2 logs crowdsec-dashboard --lines 50` (or `logs/dashboard-err.log`).
- `cscli executable not found` in logs → check `cscli.executable_path` and
  that the OS user owning the PM2 process can exec the binary; if
  `executable_path` is unset, the backend searches `/usr/bin/cscli`,
  `/usr/local/bin/cscli`, `/opt/crowdsec/bin/cscli`.
- Port `8080` rejected at startup → reserved for CrowdSec LAPI; use `8090`
  (default) or another free port (also update `--port` in the ecosystem file).
- `0.0.0.0` rejected at startup → bind to a NIC IP or loopback (`127.0.0.1`).
  Wildcard binding is forbidden by the config validator.
- `/capabilities` shows all ops `unsupported` → the startup probe failed;
  check `pm2 logs crowdsec-dashboard` for cscli invocation errors.
- `pm2: command not found` → run `npm i -g pm2` once per host.
- Build app stuck in `errored` after `pm2 restart` → inspect
  `pm2 logs crowdsec-dashboard-build`; common cause is `uv` or `npm` not on
  the owning user's `PATH` — PM2 inherits the shell PATH that started it.

## Security notes

- Loopback-only bind is the default. Exposing the dashboard on a NIC IP is
  the operator's responsibility — put it behind a reverse proxy with TLS
  and access control (`nginx`, `caddy`, `traefik`).
- The dashboard has **no** built-in authentication (plan D5). Do not expose
  it directly to the internet.
- PM2 inherits the OS user that started it. Pick a least-privilege user
  (not `root`) and ensure that user can exec `cscli` but cannot write to
  CrowdSec's data directory.
