// PM2 ecosystem for the CrowdSec Dashboard (cross-platform).
//
// Contains two apps:
//   1. `build`   — one-shot builder: `uv sync` (backend) + `npm ci && npm run build`
//                   (frontend). autorestart=false; intended to exit 0 then stay stopped.
//   2. `dashboard`— long-running uvicorn server (the FastAPI + Vite SPA on :8090).
//
// Usage:
//   npm i -g pm2              # once per host
//   pm2 start deploy/ecosystem.config.cjs --only build       # build assets (run after git pull)
//   pm2 start deploy/ecosystem.config.cjs --only dashboard  # start the server
//   pm2 logs dashboard                                            # live logs
//   pm2 restart dashboard                                         # apply code changes
//   pm2 stop dashboard                                            # stop the server
//
// OS auto-start is operator-configured (NOT bundled here, to stay OS-agnostic):
//   - Linux: `pm2 startup systemd && pm2 save`
//   - macOS: `pm2 startup launchd && pm2 save`
//   - Windows: install `pm2-windows-startup` (or `pm2-installer`) then `pm2 save`
// Run the `pm2 startup` line matching your OS, then `pm2 save` to persist the
// process list across reboots.

module.exports = {
  apps: [
    {
      // One-shot build: `uv sync` + `npm ci && npm run build`. PM2 exits to
      // 'stopped' on success (exit 0) or 'errored' on failure — autorestart
      // is OFF so it does NOT loop. Run `pm2 restart crowdsec-dashboard-build`
      // to rebuild after `git pull` or frontend code changes.
      name: 'crowdsec-dashboard-build',
      // Two things make this work in PM2 v7:
      //  - `interpreter: 'none'` so PM2 does NOT wrap the script in Node
      //    (the default — PM2 v7 would otherwise try `node /usr/bin/bash`).
      //  - `args` as an ARRAY so the multi-command `bash -c '<body>'` survives
      //    PM2's string-arg tokenizer intact. Passing it as a single string
      //    loses the inner quoting (`-c "cd backend && uv sync && ..."`
      //    becomes `-c cd backend && uv sync && ...` — 4 separate argv tokens).
      script: 'bash',
      args: [
        '-c',
        'cd backend && (uv sync --frozen 2>/dev/null || uv sync) && cd ../frontend && npm ci && npm run build && test -f dist/index.html',
      ],
      cwd: __dirname + '/..', // repo root (so `backend/` + `frontend/` resolve)
      interpreter: 'none',
      autorestart: false,
      max_restarts: 0,
      watch: false,
      // Absolute paths so PM2 always writes logs near the deploy/ directory,
      // regardless of the cwd PM2 itself was started from.
      out_file: __dirname + '/../logs/build-out.log',
      error_file: __dirname + '/../logs/build-err.log',
      merge_logs: true,
      // Inherit the operator's shell PATH so uv/npm/cscli resolve as installed.
      // No DASHBOARD_CONFIG here — build does not touch the backend runtime.
      env: {},
    },
    {
      name: 'crowdsec-dashboard',
      // `interpreter: 'none'` — `script: 'uv'` is a non-Node binary
      // (just like the `bash` build app above), so PM2 must NOT wrap it in
      // Node. Without this, PM2 v7 spawns `node uv ...` and uv never runs.
      script: 'uv',
      args: 'run uvicorn main:app --host 127.0.0.1 --port 8090',
      cwd: __dirname + '/../backend', // backend/ so `main:app` resolves
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false, // production: false (use `pm2 restart` to apply code changes)
      out_file: __dirname + '/../logs/dashboard-out.log',
      error_file: __dirname + '/../logs/dashboard-err.log',
      merge_logs: true,
      kill_timeout: 3000, // give in-flight requests a moment to drain
      env: {
        // Resolve the config file. Same precedence as backend/main.py's
        // _resolve_config_path(): DASHBOARD_CONFIG env wins; defaults below
        // point at a sibling ../config.yaml (repo root from backend/).
        DASHBOARD_CONFIG: process.env.DASHBOARD_CONFIG || '../config.yaml',
      },
    },
  ],
};
