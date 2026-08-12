# CrowdSec Dashboard — Installation Guide

Status: **MVP handover documentation** (task 12). Owner: Documentation agent.
Predecessors: `docs/requirements.md` (task 01), `docs/command-matrix.md` (task 02), `docs/architecture.md` (task 03), and the native packaging in `deploy/install/README.md` (task 11).
Consumers: system operators and administrators installing the dashboard on a CrowdSec host.

This guide is **broader** than `deploy/install/README.md`. That document stays scoped to native packaging — build, install layout, systemd unit, permissions, and update. This guide covers the full installation journey: prerequisites, build, install, configuration handoff, service supervision, networking, update, and a clean-host verification checklist. Where a step is already documented in the packaging page, this guide references it rather than duplicating it.

---

## 1. Scope and source-of-truth model

The dashboard is an **internal, single-administrator** web UI that runs on the same Linux host where CrowdSec is installed (REQ-001, REQ-002). It is a **native application** — no containers, no Kubernetes, no CI/CD (REQ-040, REQ-041, REQ-042).

The model is a **single-host source of truth**:

- CrowdSec is the source of truth and is reached **only** through approved `cscli` operations (REQ-010). The dashboard never touches the CrowdSec database directly (REQ-011) and owns no application database (REQ-012).
- The dashboard does **not** execute arbitrary commands. A request selects one of the fixed operation identifiers defined in `docs/command-matrix.md`; the adapter builds the exact argument vector internally. There is no command passthrough (REQ-014; matrix §5).
- Not every operation the dashboard knows about is supported. Operations fall into three categories (see `docs/command-matrix.md` §4/§5):
  - **Supported** — exposed as functional controls in the UI.
  - **Capability-gated** — available only when the startup probe confirms the installed CrowdSec supports them; otherwise reported `unsupported` (e.g. `machines.prune`, `bouncers.delete`, filter/`-o json` support, `metrics.show`, `capi.status`).
  - **Explicitly unsupported** — no control and no endpoint (e.g. `alerts.delete`, `decisions.import`, `machines.delete`, `bouncers.add`, `hub.update`, `scenarios.install`, `collections.install`, `collections.remove`, `simulation.enable`, `simulation.disable`, `allowlists.import`).

The install procedure must not assume a version-dependent operation is available; the dashboard reports capability state read-only through `GET /api/v1/capabilities` and renders no control when a row is unsupported.

## 2. Prerequisites

- **Target host:** a native Linux host with CrowdSec installed. The matrix is validated against CrowdSec **1.7.8**; version-dependent rows stay capability-gated until a live target-environment run and CrowdSec-domain sign-off promote them.
- **Build host:** native Go ≥ 1.22 (`backend/go.mod`) and Node.js ≥ 18.18 (`frontend/package.json` engines), with `npm install` already run in `frontend/`. The build is reproducible through `backend/build.sh`; no containers are used.
- **Service account:** a dedicated least-privilege account named `crowdsec-dashboard` (REQ-062). See §4.

## 3. Build (native, from source)

The dashboard is a single self-contained Linux binary. It embeds the production frontend bundle (built by `next build` and compiled in with `go:embed`), so the binary alone serves the whole UI.

```bash
backend/build.sh                        # outputs backend/bin/crowdsec-dashboard
# or to a custom path:
backend/build.sh /tmp/crowdsec-dashboard
```

`backend/build.sh` does three things:

1. Builds the frontend static export (`frontend/out`) via `next build`.
2. Stages that export into `backend/internal/assets/bundle/` (the Go `embed` package).
3. Builds the Go binary with `CGO_ENABLED=0` (fully static, no shared-library runtime dependencies) and embeds the bundle.

Cross-compilation works through the standard `GOOS`/`GOARCH`/`CGO_ENABLED` environment variables; the default target is `linux/amd64`. Full details are in `deploy/install/README.md` §1.

> **No Docker, no Podman.** Everything runs with the native Go and Node.js toolchains on the build host.

## 4. Service account and permissions

Create the least-privilege service account (it is **never** root):

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin \
  crowdsec-dashboard
```

The dashboard invokes `cscli` with the service account's permissions. Grant only the minimum for the **supported** operations and the read-only profiles boundary:

- **Read** access for the list/inspect/status operations (`alerts`, `decisions`, `machines`, `bouncers`, `scenarios`, `collections`, `hub`, `simulation.status`, `lapi.status`, `capi.status`, `metrics.show`, `allowlists`).
- **Mutation** access for the matrix-approved mutations when present: `decisions.add`, `decisions.delete`, and local allowlist create/add/remove/delete.
- **Environment-gated mutations** (`machines.prune`, `bouncers.delete`) are capability-probed at startup and reported `unsupported` unless the probe confirms safe support. They must **not** drive additional privileges.
- **Read access** to `/etc/crowdsec/profiles.yaml` (or the configured `crowdsec_config_dir`) for the read-only `profiles.inspect` boundary.

The exact `cscli` permission grants depend on the CrowdSec installation method and its LAPI access model. Confirm the required grants against your installed CrowdSec; the dashboard reports `permission_denied` (never a silent retry with elevated privileges) when a command is not permitted. `deploy/install/README.md` §3.1 gives the full breakdown.

> **Unsupported operations must not drive additional privileges.** If a row is not supported, the dashboard exposes no control and the service account needs no permission for it.

## 5. Configuration handoff

The binary loads a single local YAML configuration file at startup. The authoritative field table and validation rules are in `docs/architecture.md` §8; every field is documented with a non-secret sample in `deploy/config.example.yaml`.

The dashboard requires a real `auth.admin_password_hash` (bcrypt or argon2id). The placeholder value (anything starting with `<`) is **refused at startup** — the server exits with a clear message rather than creating a default password. Generate the hash and complete the single-admin setup **before** first start; the full procedure is in `docs/configuration-guide.md` §3.

Copy the example config, set the hash, restrict permissions, and pass the path with `--config`:

```bash
install -d -o root -g crowdsec-dashboard -m 0750 /etc/crowdsec-dashboard
install -o root -g crowdsec-dashboard -m 0640 \
  deploy/config.example.yaml /etc/crowdsec-dashboard/config.yaml
# ... edit /etc/crowdsec-dashboard/config.yaml to set the password hash ...
/usr/local/bin/crowdsec-dashboard --config /etc/crowdsec-dashboard/config.yaml
```

See `docs/configuration-guide.md` for the config fields, the secure administrator setup, session behavior, and the mutation confirmation flow.

## 6. Supervision under systemd

The packaging includes a systemd unit at `deploy/crowdsec-dashboard.service`. Install it and start the service:

```bash
install -o root -g root -m 0644 \
  deploy/crowdsec-dashboard.service /etc/systemd/system/crowdsec-dashboard.service
systemctl daemon-reload
systemctl enable --now crowdsec-dashboard
```

Key unit behavior (see `deploy/install/README.md` §4 and the unit itself):

- `Type=simple` — the binary is the main process.
- `After=crowdsec.service`, `Wants=crowdsec.service` — the dashboard drives CrowdSec through `cscli`, so it starts after CrowdSec's LAPI. `Wants=` (not `Requires=`) keeps the dashboard startable even if the CrowdSec unit differs; `Restart=on-failure` retries if `cscli` is not ready.
- `User=crowdsec-dashboard`, `Group=crowdsec-dashboard` — least-privilege service account.
- **No `ExecReload`** — the binary loads configuration once at startup and does not implement live reload. After editing `config.yaml`, restart the service.

### 6.1 Lifecycle commands

```bash
systemctl start   crowdsec-dashboard   # start
systemctl stop    crowdsec-dashboard   # stop
systemctl restart crowdsec-dashboard   # stop + start
systemctl status  crowdsec-dashboard   # status
journalctl -u crowdsec-dashboard -f    # live logs (stderr → journald)
```

### 6.2 Startup validation

An invalid configuration (missing password hash, bad path, unsafe bind, port collision, etc.) is a **clear startup error**: the process exits non-zero without listening and systemd records the failure. Verify:

```bash
# Config is valid:
/usr/local/bin/crowdsec-dashboard --config /etc/crowdsec-dashboard/config.yaml
# (interrupt with Ctrl-C once it reports "listening")

# Service is serving:
curl -sS http://127.0.0.1:8090/api/v1/health
curl -sS http://127.0.0.1:8090/          # dashboard HTML
```

## 7. Networking and HTTPS boundary

- **Default bind is `127.0.0.1`** (localhost only). The dashboard is not exposed by default (REQ-061). A wildcard `0.0.0.0` bind is rejected by configuration validation.
- To expose it on a trusted internal network, set `server.bind` to a specific trusted interface address.
- **HTTPS responsibility:** the dashboard binary does not terminate TLS. When the dashboard crosses an **untrusted** network, you MUST place it behind a reverse proxy that terminates TLS (e.g. nginx/Caddy) and forwards to `127.0.0.1:8090`. The session cookie is set `Secure` when served over TLS and `SameSite=Strict` always.

## 8. Update procedure

Because the UI is embedded in the binary, updating the dashboard means rebuilding (or replacing) the binary and restarting the service. The procedure is deliberately **rollback-safe** — it never overwrites the live config and never attempts a destructive shortcut:

1. Pull the new source and rebuild:
   ```bash
   backend/build.sh
   ```
   (This also rebuilds the frontend bundle and re-embeds it.)
2. Check the new `deploy/config.example.yaml` for any new/changed settings; merge non-secret changes into your live `/etc/crowdsec-dashboard/config.yaml` if needed.
3. Replace the binary and restart:
   ```bash
   systemctl stop crowdsec-dashboard
   install -o root -g root -m 0755 \
     backend/bin/crowdsec-dashboard /usr/local/bin/crowdsec-dashboard
   systemctl start crowdsec-dashboard
   ```
4. Verify health and the UI as in §6.2.

The config file is **not** overwritten by an update; it lives separately in `/etc/crowdsec-dashboard/` and is preserved. To roll back, reinstall the previous binary and restart — no destructive flag, no direct database manipulation, and no command passthrough is involved.

## 9. Clean-host verification checklist

A documentation-only walkthrough using a clean host should confirm each of the following:

1. **Build** — `backend/build.sh` produces a single static binary with the UI embedded.
2. **Install layout** — binary at `/usr/local/bin/crowdsec-dashboard`, config at `/etc/crowdsec-dashboard/config.yaml` with the documented modes and ownership (`deploy/install/README.md` §2).
3. **Service account** — `crowdsec-dashboard` exists, is non-login, and is not root.
4. **Config** — a real `auth.admin_password_hash` is set; the placeholder is refused at startup with a clear message.
5. **Start** — the service starts after CrowdSec, reports listening, and serves `/api/v1/health` and the UI.
6. **Auth** — login succeeds only with the configured password; logout invalidates the session; session expiry is honored.
7. **Source-of-truth read** — Overview, Alerts, Decisions, Machines, Scenarios/Profiles/Collections, Allowlists, and Bouncers render from live `cscli` responses.
8. **Mutations** — a confirmed `decisions.add`/`decisions.delete` and a local allowlist create/add are reflected after refresh.
9. **Capability honesty** — capability-gated and unsupported rows render no functional control and are reported read-only.
10. **Update** — replacing the binary and restarting preserves the config and serves the new UI.

## 10. Non-goals

This guide does **not** cover, and the dashboard does not provide:

- **Database backup/restore** — the dashboard owns no application database and never stores alert or decision data; CrowdSec remains the source of truth (REQ-046).
- **Monitoring platforms** — no Prometheus/Grafana integration; dashboard statistics are ordinary CrowdSec data, never a monitoring-platform claim (REQ-043, REQ-044).
- **Notifications** — no email/webhook alerting or notification workflows (REQ-045).
- **Containers** — no Docker/Podman (REQ-040); no Kubernetes (REQ-041); no CI/CD (REQ-042).
- **Multi-user identity** — one local administrator only; no RBAC, LDAP/OIDC, or user management (REQ-047, REQ-048).

## Files

| File | Purpose |
| ---- | ------- |
| `docs/installation-guide.md` | this document |
| `docs/configuration-guide.md` | configuration and single-admin setup |
| `docs/administrator-guide.md` | daily per-page administration |
| `docs/troubleshooting.md` | safe troubleshooting for failed operations |
| `docs/command-matrix.md` | authoritative operation allowlist (task 02) |
| `docs/architecture.md` | API/config contracts (task 03) |
| `deploy/install/README.md` | native packaging details (task 11) |
| `deploy/config.example.yaml` | sample configuration (non-secret placeholders) |
| `deploy/crowdsec-dashboard.service` | systemd unit |
| `backend/build.sh` | reproducible native build |