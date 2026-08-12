# CrowdSec Dashboard — Native Linux Installation (task 11)

This document covers **native packaging + systemd + permissions + update** for
the CrowdSec dashboard. It is scoped to a single Linux host where CrowdSec is
installed (REQ-001, REQ-002). There are **no containers** (REQ-040), no
Kubernetes (REQ-041), no CI/CD (REQ-042), and no database or monitoring
infrastructure (REQ-003, REQ-049).

Broader administrator/troubleshooting guidance lives in the task 12
documentation; this page stays focused on getting the binary installed,
configured, and supervised by systemd.

---

## Overview

The dashboard is a single self-contained Linux binary. It embeds the
production frontend bundle (built by `next build` and compiled in with
`go:embed`), so the binary alone serves the whole UI. CrowdSec remains the
source of truth and is reached **only** through approved `cscli` commands.

```
browser ──► crowdsec-dashboard:8090 ──► cscli ──► CrowdSec / LAPI
              │
              └── embedded frontend bundle (served at /)
```

For an authoritative list of the operations the dashboard may perform and
which are capability-gated, see `docs/command-matrix.md`.

---

## 1. Build (from source; no containers)

Prerequisites on the **build host** (native tooling only):

- Go ≥ 1.22 (`backend/go.mod`)
- Node.js ≥ 18.18 (`frontend/package.json` engines)
- `npm install` already run in `frontend/`

Build the binary with the reproducible script:

```bash
backend/build.sh                # outputs backend/bin/crowdsec-dashboard
# or to a custom path:
backend/build.sh /tmp/crowdsec-dashboard
```

`build.sh` does three things:

1. Builds the frontend static export (`frontend/out`) via `next build`.
2. Stages that export into `backend/internal/assets/bundle/` (the Go embed
   package).
3. Builds the Go binary with `CGO_ENABLED=0` (fully static, no shared-library
   runtime dependencies) and embeds the bundle in it.

The result is one portable Linux binary. Cross-compilation is possible via the
standard `GOOS`/`GOARCH`/`CGO_ENABLED` environment variables; the default
target is `linux/amd64`.

> **No Docker, no Podman.** Everything runs with the native Go and Node.js
> toolchains on the build host.

---

## 2. Install layout

Paths in this document are the **contracted defaults**; the systemd unit and
the binary's `--config` flag must agree on them.

| Path | Purpose | Mode | Owner |
| ---- | ------- | ---- | ----- |
| `/usr/local/bin/crowdsec-dashboard` | the binary | `0755` | `root:root` |
| `/etc/crowdsec-dashboard/config.yaml` | runtime configuration | `0640` | `root:crowdsec-dashboard` |
| `/etc/crowdsec-dashboard/` | config directory | `0750` | `root:crowdsec-dashboard` |
| `/etc/crowdsec/profiles.yaml` | read-only profiles source (optional) | read-only | readable by `crowdsec-dashboard` |

The frontend assets are **embedded** in the binary — there is no separate
assets directory on disk. This satisfies "assets delivered with the native
package" while keeping the service path surface minimal.

### 2.1 Supported configuration

The sample config at `deploy/config.example.yaml` documents every setting.
Briefly (all defaults in `backend/internal/config/config.go`):

- `server.bind`: default `127.0.0.1` (localhost). `0.0.0.0` is rejected.
- `server.port`: default `8090`; `8080` is rejected (LAPI collision).
- `cscli.executable_path`: default `/usr/bin/cscli`.
- `cscli.timeout`: default `30s` (1s–120s).
- `cscli.crowdsec_config_dir`: default `/etc/crowdsec`; used **only** by the
  read-only `profiles.inspect` boundary to read `<dir>/profiles.yaml`. It is
  never an arbitrary command-execution or config-editing path
  (REQ-014, REQ-064; `docs/command-matrix.md` §5).
- `auth.admin_password_hash`: **required, no default**; bcrypt or argon2id
  hash of the administrator password.
- `session.ttl`: default `8h` (15m–24h).
- `session.cookie_name`: default `crowdsec_dashboard_session`.
- `logging.level` / `format` / `output`: default `info` / `text` / `stderr`.

### 2.2 Administrator password hash

The config requires a real `auth.admin_password_hash`; the placeholder
`<set-this-to-bcrypt-or-argon2id-hash>` (and anything starting with `<`) is
refused at startup — the server exits with a clear message rather than
creating a default password.

Generate a bcrypt hash locally, for example with the `htpasswd` utility
(you may need to install `apache2-utils`/`httpd-tools`):

```bash
htpasswd -bnBC 12 "" 'your-admin-password' | tr -d ':\n'
```

or with a one-liner Go program using `golang.org/x/crypto/bcrypt`. Then put
the resulting `$2a$...` / `$2b$...` value into `auth.admin_password_hash`.
The dashboard verifies bcrypt and argon2id hashes (see
`backend/internal/auth/password.go`).

---

## 3. Service account and permissions

The dashboard runs as a dedicated **least-privilege** service account
(REQ-062). It is never root. Create the account and group:

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin \
  crowdsec-dashboard
```

### 3.1 What the service account needs

The dashboard invokes `cscli` with the service account's permissions. Grant
only the minimum for the **supported** operations and the read-only profiles
boundary:

- **Read** for `cscli` list/inspect/status operations (`alerts`, `decisions`,
  `machines`, `bouncers`, `scenarios`, `collections`, `hub`, `simulation.status`,
  `lapi.status`, `capi.status`, `metrics.show`, `allowlists`).
- **Mutation** for the matrix-approved mutations when present:
  `decisions.add`, `decisions.delete`, and local `allowlists` create/add/
  remove/delete.
- **Environment-gated mutations** (`machines.prune`, `bouncers.delete`) are
  capability-probed at startup and reported `unsupported` unless the probe
  confirms safe support. They must **not** drive additional privileges; if the
  probe cannot confirm them, the dashboard simply omits the control.
- **Read access** to `/etc/crowdsec/profiles.yaml` (or the configured
  `crowdsec_config_dir`) for the read-only `profiles.inspect` boundary.

The exact `cscli` permission grants depend on the CrowdSec installation
method and its LAPI access model. In practice, on a standard CrowdSec
installation the service account is typically granted membership of the
`crowdsec` group so it can read the CrowdSec config, and the CrowdSec LAPI
`LocalAPI`/`CAPI` access is governed by the LAPI's own authentication. Confirm
the required grants against your installed CrowdSec; the dashboard reports
`permission_denied` (never a silent retry with elevated privileges) when a
command is not permitted.

> **Unsupported mutations must not drive additional privileges.** If an
> operation is not supported (e.g. `scenarios.install`, `hub.update`,
> `bouncers.add`, machine deletion), the dashboard exposes no control and the
> service account needs no permission for it.

### 3.2 File permissions

```bash
# Config directory and file
install -d -o root -g crowdsec-dashboard -m 0750 /etc/crowdsec-dashboard
install -o root -g crowdsec-dashboard -m 0640 \
  deploy/config.example.yaml /etc/crowdsec-dashboard/config.yaml

# Binary
install -o root -g root -m 0755 \
  backend/bin/crowdsec-dashboard /usr/local/bin/crowdsec-dashboard
```

The config is `0640 root:crowdsec-dashboard`: readable by the service account,
writable only by root. The binary is `0755 root:root` (executable, owned by
root, not writable by the service account).

---

## 4. systemd supervision

Install the unit and start the service:

```bash
install -o root -g root -m 0644 \
  deploy/crowdsec-dashboard.service /etc/systemd/system/crowdsec-dashboard.service
systemctl daemon-reload
systemctl enable --now crowdsec-dashboard
```

Behavior (see `deploy/crowdsec-dashboard.service`):

- **`Type=simple`** — the binary is the main process.
- **`After=crowdsec.service` / `Wants=crowdsec.service`** — the dashboard
  drives CrowdSec through `cscli`, so it starts after CrowdSec's LAPI.
  `Wants=` (not `Requires=`) keeps the dashboard startable even if the
  CrowdSec unit differs; `Restart=on-failure` retries if `cscli` is not ready.
- **`Restart=on-failure` / `RestartSec=3s`** — restarts on failure/crash.
- **`User=crowdsec-dashboard` / `Group=crowdsec-dashboard`** — least-privilege
  service account.
- **Logging via journald** — the binary writes to stderr
  (`logging.output: "stderr"`); journald captures it.

### 4.1 Basic lifecycle

```bash
systemctl start   crowdsec-dashboard   # start
systemctl stop    crowdsec-dashboard   # stop
systemctl restart crowdsec-dashboard   # stop + start
systemctl status  crowdsec-dashboard   # status
journalctl -u crowdsec-dashboard -f    # live logs
```

There is **no `ExecReload`**: the binary loads configuration once at startup
and does not implement live reload. After editing `config.yaml`, restart the
service.

### 4.2 Startup validation

An invalid configuration (missing password hash, bad path, `0.0.0.0` bind,
port `8080`, etc.) is a **clear startup error**: the process exits non-zero
without listening, and systemd records the failure. A quick check:

```bash
# Config is valid:
/usr/local/bin/crowdsec-dashboard --config /etc/crowdsec-dashboard/config.yaml
# (interrupt with Ctrl-C once it reports "listening")

# Verify the service is serving:
curl -sS http://127.0.0.1:8090/api/v1/health
curl -sS http://127.0.0.1:8090/          # dashboard HTML, not a placeholder
```

---

## 5. Networking and HTTPS

- **Default bind is `127.0.0.1`** (localhost only). The dashboard is not
  exposed by default (REQ-061).
- To expose it on a trusted internal network, set `server.bind` to a specific
  trusted interface address. It is **never** safe to bind a wildcard
  `0.0.0.0` (rejected by validation).
- **HTTPS responsibility:** the dashboard binary does not terminate TLS.
  When the dashboard crosses an **untrusted** network, you MUST place it
  behind a reverse proxy that terminates TLS (e.g. nginx/Caddy) and forwards
  to `127.0.0.1:8090`. The session cookie is set `Secure` when served over
  TLS, and `SameSite=Strict` always.

---

## 6. Update procedure

Because the UI is embedded in the binary, updating the dashboard means
rebuilding (or replacing) the binary and restarting the service. Steps:

1. Pull the new source and rebuild:
   ```bash
   backend/build.sh
   ```
   (This also rebuilds the frontend bundle and re-embeds it.)
2. Check the new `deploy/config.example.yaml` for any new/changed settings;
   merge non-secret changes into your live config if needed.
3. Replace the binary and restart:
   ```bash
   systemctl stop crowdsec-dashboard
   install -o root -g root -m 0755 \
     backend/bin/crowdsec-dashboard /usr/local/bin/crowdsec-dashboard
   systemctl start crowdsec-dashboard
   ```
4. Verify health and the UI as in §4.2.

The config file is **not** overwritten by the update; it lives separately in
`/etc/crowdsec-dashboard/` and is preserved.

---

## 7. Capability-gated / version-dependent operations

Per `docs/command-matrix.md`, several rows are **capability-gated** or
**version-dependent** and require a live target-environment run **and
CrowdSec-domain sign-off** before they may be promoted:

- `machines.prune` — always prompts interactively; without an approved
  non-interactive confirmation mechanism the startup probe reports
  `unsupported`. No functional control until sign-off.
- `bouncers.delete` — supported only when the dashboard is co-located with
  LAPI; otherwise reported `unsupported`.
- Filter/`-l`/`-o json` support for list operations — probed at startup;
  unsupported flags are reported `unsupported`, never guessed into existence.
- `metrics.show` and `capi.status` — optional/environment-dependent.

These are surfaced read-only through `GET /api/v1/capabilities` and render no
functional control when unsupported. **Sign-off is pending**; do not assume an
operation is supported in a target environment without the probe confirming it.

---

## Files

| File | Purpose |
| ---- | ------- |
| `backend/build.sh` | reproducible native build (frontend bundle + binary) |
| `backend/internal/assets/` | Go `embed` package for the frontend bundle |
| `deploy/config.example.yaml` | sample configuration (non-secret placeholders) |
| `deploy/crowdsec-dashboard.service` | systemd unit |
| `deploy/install/README.md` | this document |