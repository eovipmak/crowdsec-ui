# CrowdSec Dashboard — Configuration Guide

Status: **MVP handover documentation** (task 12). Owner: Documentation agent.
Predecessors: `docs/command-matrix.md` (task 02), `docs/architecture.md` (task 03), and `deploy/config.example.yaml` (task 11).
Consumers: system operators configuring the dashboard and completing single-administrator setup.

This guide covers the configuration file, the secure single-administrator setup, session behavior, and the mutation confirmation flow. The authoritative field table and validation rules are in `docs/architecture.md` §8; the non-secret sample shape is in `deploy/config.example.yaml`. This guide explains how to apply them.

---

## 1. Configuration file overview

The local configuration file is the **only** persistence in the dashboard (REQ-012). It holds the single administrator account (a password **hash**, never a plaintext password) and server/cscli/session/logging settings. It is read **once at startup** and is never consulted per request. It is also never served to the browser and never edited through the UI — configuration changes are operator edits followed by a service restart.

- **Format:** YAML (CrowdSec ecosystem convention).
- **Location:** default `/etc/crowdsec-dashboard/config.yaml`, overridable only by the single `--config <path>` flag.
- **Permissions:** `0640`, owned by `root:crowdsec-dashboard` (service account readable, only root writable) — enforced in deployment (`deploy/install/README.md` §3.2).
- **Secret handling:** the only secret is `auth.admin_password_hash`. It is never logged and never served; samples use a non-secret placeholder.

## 2. Supported fields

The full field table with types, defaults, and validation is in `docs/architecture.md` §8.1. The settings you will most often touch:

| Field | Default | Purpose |
|---|---|---|
| `server.bind` | `127.0.0.1` | Bind address. **Never** `0.0.0.0` by default (rejected). Use a trusted internal interface only when intentionally exposing the dashboard. |
| `server.port` | `8090` | Listen port. Avoid `8080` (CrowdSec LAPI default) on the same host. |
| `cscli.executable_path` | `/usr/bin/cscli` | Absolute path to `cscli`. Must resolve at startup or the server refuses to start. Never selectable from the browser. |
| `cscli.timeout` | `30s` | Per-command execution timeout (1s–120s). |
| `cscli.crowdsec_config_dir` | `/etc/crowdsec` | Server-side directory; used **only** by the read-only `profiles.inspect` boundary to read `<dir>/profiles.yaml`. Never browser-controlled, never an editing facility. |
| `auth.admin_password_hash` | — | **Required, no default.** bcrypt or argon2id hash of the administrator password. |
| `session.ttl` | `8h` | Session expiry (15m–24h). Fixed expiry; no sliding renewal in MVP. |
| `session.cookie_name` | `crowdsec_dashboard_session` | HttpOnly session cookie name. |
| `logging.level` / `format` / `output` | `info` / `text` / `stderr` | Logging controls. `stderr` is recommended for systemd/journald. |

### 2.1 Sample configuration

The non-secret sample shape is in `deploy/config.example.yaml`. Copy it, set the password hash, and adjust only the fields your deployment needs:

```bash
install -d -o root -g crowdsec-dashboard -m 0750 /etc/crowdsec-dashboard
install -o root -g crowdsec-dashboard -m 0640 \
  deploy/config.example.yaml /etc/crowdsec-dashboard/config.yaml
```

Edit `/etc/crowdsec-dashboard/config.yaml` to replace the placeholder `auth.admin_password_hash` with a real hash (see §3). After any change, restart the service — the binary does not implement live reload.

### 2.2 Startup refusal for an unconfigured secret

On first start with the placeholder/unset hash, the server **refuses to start** and prints a fixed instruction pointing at this administrator-setup procedure. No default password is ever created (REQ-060; architecture §8.3). The check simply rejects any value starting with `<` as a placeholder token, so a real hash must be supplied.

## 3. Secure initial administrator setup

There is **no default password**. You provide a bcrypt (or argon2id) hash of the password you choose; the dashboard verifies bcrypt and argon2id hashes. The plaintext password is never stored and never transmitted to the dashboard configuration.

### 3.1 Generate a hash

Generate a **bcrypt** hash locally, for example with the `htpasswd` utility (you may need to install `apache2-utils`/`httpd-tools`):

```bash
htpasswd -bnBC 12 "" 'choose-a-strong-password' | tr -d ':\n'
```

or with a one-line Go program using `golang.org/x/crypto/bcrypt`. The result is a `$2a$...` / `$2b$...` value. **argon2id** PHC hashes are also accepted (`$argon2id$v=19$m=<mem>,t=<time>,p=<threads>$<salt>$<hash>`).

### 3.2 Apply the hash

Put the resulting hash into `auth.admin_password_hash` in `/etc/crowdsec-dashboard/config.yaml`. The config file is `0640 root:crowdsec-dashboard`, so only the service account can read it; keep it that way.

> **Credential hygiene.** Use a unique, strong password. Never commit a real hash to version control — samples use the placeholder only. The hash is never displayed in the UI or logs. If you need to rotate the password, regenerate a hash and restart the service (there is no in-UI password change).

## 4. Login, logout, and sessions

- **Login** — `POST /api/v1/session` accepts a single field, `{"password": "..."}`. The administrator identity is implicit (one account). Success sets a session cookie and returns the session status plus the CSRF token. Login failures return an identical `401 invalid_credentials` message regardless of cause — there is no account enumeration.
- **Session cookie** — `HttpOnly`, `SameSite=Strict`, `Path=/`, named `crowdsec_dashboard_session`. The `Secure` attribute is set when the request arrived over HTTPS. Expiry follows `session.ttl` (fixed; no sliding renewal).
- **Session status** — `GET /api/v1/session` returns the current session and CSRF token; the frontend uses it to handle expired sessions.
- **Logout** — `DELETE /api/v1/session` invalidates the session server-side, clears the cookie, and returns `{ "session": { "authenticated": false } }`. Logged-out token reuse returns `401 unauthenticated`.
- **Expired session** — the frontend redirects to the login page when a session expires or is invalidated.

## 5. The two-step mutation confirmation flow

Every mutation in the MVP requires explicit confirmation (REQ-027). The flow is **server-verifiable** and bound to the operation plus the typed request — it is not a frontend-only flag (architecture §4.7).

1. **Issue a confirmation** — `POST /api/v1/confirmations` sends `{"operation": "<mutation op>", "request": {<typed request>}}`. The server validates that the operation is a mutation and validates the typed request **before** issuing a token. The response includes:
   - `token` — opaque, bound to operation + request + session, expires after 5 minutes.
   - `action` — a fixed human label identifying the CrowdSec action.
   - `command_label` — the fixed operation label (e.g. `cscli decisions add`), never an executed command line.
2. **Execute the confirmed mutation** — the mutation endpoint runs only when the body carries that exact `confirmation` token. Any difference in the operation or any typed request field invalidates the token (`409 invalid_confirmation`); expiry does the same. A mutating request without a `confirmation` field returns `400 confirmation_required`.

After a successful mutation the adapter performs the matrix-defined refresh (e.g. `decisions.list` after `decisions.add`) and the frontend re-fetches the affected lists.

## 6. Configuration contracts to remember

- On first start with the placeholder/unset hash, the server **refuses to start** and prints a fixed instruction pointing at this procedure.
- `cscli.crowdsec_config_dir` exists solely for the approved read-only `profiles.inspect` boundary. It is never an input to any command and never exposed to the browser.
- Bind/port/logging/session values are operator settings; unsafe defaults (wildcard bind, LAPI collision on `8080`) are prohibited.
- Configuration values never arrive from a browser request, and no configuration file is ever served.

## 7. Non-goals

Configuration is operator-side only. This guide does **not** cover rotating credentials through the UI, multi-user or RBAC identity, monitoring-platform integration, notification wiring, container configuration, or database backup/restore — none of which are MVP features (REQ-045 – REQ-049).