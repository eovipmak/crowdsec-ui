# CrowdSec Dashboard — Troubleshooting Guide

Status: **MVP handover documentation** (task 12). Owner: Documentation agent.
Predecessors: `docs/command-matrix.md` (task 02) and `docs/architecture.md` (task 03, §4.5 error classes).
Consumers: system operators diagnosing startup, authentication, permission, missing-command, invalid-output, timeout, and CrowdSec failures.

This guide uses **only** the six safe operation error classes defined by the matrix and architecture: `unsupported`, `malformed_output`, `permission_denied`, `timeout`, `unavailable`, and `crowdsec_failure`. These are stable codes returned in the operation error envelope; the dashboard never exposes raw `stderr`, secrets, or executed command lines. For every symptom below, the operator fix is distinguished from an operation that is unsupported by design.

> **Secret safety.** Never request or enter credentials, tokens, or password hashes while troubleshooting. The dashboard never exposes secrets, and the troubleshooting steps below never require them.

---

## 1. Diagnosing from logs

The dashboard writes to stderr, which systemd sends to journald:

```bash
journalctl -u crowdsec-dashboard -f        # live logs
journalctl -u crowdsec-dashboard -u last   # last unit's logs
systemctl status crowdsec-dashboard        # service status and recent logs
```

At startup the binary logs its redacted configuration — the password hash is always logged as `<redacted>`. A startup failure is a clear, non-zero exit with a message; the server does not listen on failure.

For CrowdSec-side diagnostics you may use `cscli` directly **as an operator** (never through the dashboard) to inspect the environment, for example:

```bash
cscli alerts list -o json
cscli decisions list -o json
cscli lapi status
```

These are read-only diagnostics. Do not use the dashboard's unsupported operations through `cscli` as a workaround for a dashboard limitation — see §2.

## 2. Error classes and operator fixes

### `unsupported`

**Meaning:** the installed CrowdSec does not support the requested operation, or the operation is explicitly unsupported in the MVP. Reported when a capability-gated row is not confirmed by the startup probe, or when a matrix §5.3 row is requested.

**Operator fix:** none required — this is by design, not a fault. The UI renders no functional control for unsupported rows. Examples that will always report `unsupported` and have **no** operator workaround through the dashboard:

- `alerts.delete`, `decisions.import`, `machines.delete`, `bouncers.add`, `hub.update`, `scenarios.install`, `collections.install`, `collections.remove`, `simulation.enable`, `simulation.disable`, `allowlists.import`.
- Capability-gated rows when the probe does not confirm them: `machines.prune` (always prompts interactively; without an approved non-interactive confirmation mechanism the probe reports `unsupported`), `bouncers.delete` (requires the dashboard to be co-located with LAPI), and version-dependent structured-output/filter flags.

**Do not** attempt to bypass an `unsupported` result with arbitrary flags, `--force`, `--all`, direct database access, or a raw command line. Those are explicitly prohibited (matrix §4; architecture §3).

### `malformed_output`

**Meaning:** a `cscli` command returned output that did not match the expected structured shape (JSON or raw CSV) for the operation.

**Operator fix:** confirm the installed CrowdSec version matches what the operation expects (the matrix is validated against 1.7.8) and that the `-o json`/`-o raw` flags are genuinely supported. If the environment reports a supported operation but returns malformed output, the structured-output flag may be version-dependent; the startup probe should have reported it `unsupported` — if it did not, verify the executable resolved is the intended `cscli` (see `unavailable`) and that its version matches the expectations. This is not a secret-related issue.

### `permission_denied`

**Meaning:** the service account lacks permission to run the operation. The dashboard **never retries with elevated privileges** (architecture §4.5).

**Operator fix:** grant the service account the minimum permission for the **supported** operations (see `docs/installation-guide.md` §4 and `deploy/install/README.md` §3.1). Only grant what a supported operation needs; unsupported operations must not drive additional privileges. Confirm the service account can read `/etc/crowdsec/profiles.yaml` for the read-only `profiles.inspect` boundary. After changing permissions, restart the service.

### `timeout`

**Meaning:** the command exceeded the configured `cscli.timeout` (default `30s`, 1s–120s). This is retryable.

**Operator fix:** retry the operation. If it consistently times out, consider raising `cscli.timeout` in the config (within the 1s–120s bound) and restarting the service. Verify the target CrowdSec/LAPI is responsive (`cscli lapi status` as operator). A chronically timing-out operation may indicate an overloaded LAPI rather than a dashboard fault.

### `unavailable`

**Meaning:** the `cscli` executable is missing or not resolvable, or the server is not ready.

**Operator fix:** verify `cscli.executable_path` resolves and that `cscli` is installed and runnable by the service account. Confirm the executable path in the config matches the actual install location. If the executable is missing, install/restore CrowdSec and restart the dashboard. This is retryable.

### `crowdsec_failure`

**Meaning:** a non-zero `cscli` exit with no more specific class (for example, an allowlist rejected a `decisions.add`, or an absent target on a read). The dashboard maps this to a safe, generic message and never returns raw `stderr`.

**Operator fix:** inspect the CrowdSec environment with read-only `cscli` diagnostics. For `decisions.add`, an allowlist may be rejecting the target — the operation is reported as `crowdsec_failure` and the dashboard does **not** expose `--bypass-allowlist` (matrix §4). For a read, confirm the expected target exists (e.g. an absent alert/inspect target). This class is not retryable.

## 3. Startup failures

The dashboard refuses to start on any invalid configuration and prints a clear message before listening. Common causes and fixes:

| Symptom | Cause | Fix |
| --- | --- | --- |
| Refuses to start, message about `admin_password_hash` | Password hash unset or placeholder (starts with `<`) | Complete the secure administrator setup (`docs/configuration-guide.md` §3); no default password exists. |
| Refuses to start, `cscli.executable_path` not resolvable | `cscli` missing or wrong path | Set the correct absolute path or restore `cscli`; restart. See `unavailable` above. |
| Refuses to start, unsafe bind | `server.bind` is `0.0.0.0` | Use `127.0.0.1` or a trusted specific interface (architecture §8). |
| Refuses to start, port collision | `server.port` is `8080` (LAPI default) | Use the default `8090` or another port. |
| Refuses to start, timeout out of range | `cscli.timeout` outside 1s–120s | Set a value within the bound. |
| Refuses to start, session TTL out of range | `session.ttl` outside 15m–24h | Set a value within the bound. |

After fixing `config.yaml`, restart the service (the binary does not implement live reload).

## 4. Authentication and session failures

- **Login fails with `Invalid username or password.`** — the message is identical for every cause (no account enumeration). Confirm the configured `auth.admin_password_hash` was generated for the password you are entering and that it is a bcrypt or argon2id hash. Regenerate and reapply if needed (`docs/configuration-guide.md` §3).
- **Session expires unexpectedly** — expiry follows `session.ttl` (fixed; no sliding renewal). Log in again. If sessions expire too quickly, raise `session.ttl` within the 15m–24h bound.
- **Logout appears ineffective** — logout invalidates the session server-side; logged-out token reuse returns `401 unauthenticated`. Reload the dashboard and log in again.
- **Dashboard redirects to login while working** — the session expired or was invalidated. Log in again.
- **Mutations fail with `csrf_failed` / `confirmation_required` / `invalid_confirmation`** — the CSRF token or confirmation token is missing/mismatched. Reload the page to obtain a fresh session and CSRF token, then retry the mutation. Confirmation tokens expire after 5 minutes and are bound to the exact operation and request.

Troubleshooting auth never requires a password hash or token — do not enter or request one.

## 5. Permission and missing-command failures

- **`permission_denied`** — the service account lacks permission for a supported operation. Grant the minimum grants per `docs/installation-guide.md` §4 and restart. Never run the dashboard as root to "fix" this; least-privilege is required (REQ-062).
- **`unavailable`** — `cscli` not found or not resolvable. Verify `cscli.executable_path` and that the service account can execute it.
- **Missing `cscli` operation** — if a supported operation is absent from the installed CrowdSec, the startup probe reports it `unsupported`; do not attempt to invent or force it. Confirm the installed CrowdSec version and that the intended executable is resolved.

## 6. Invalid output handling

- **`malformed_output`** — the operation returned output that did not match the expected shape. Verify the version-dependent structured-output flags are supported for the installed CrowdSec. Do not fall back to parsing human output as if it were stable; the dashboard reports `unsupported` for a rejected `-o json` rather than guessing.
- **Empty results are not errors.** A successful empty collection returns `items: []` and is valid (matrix §2). If a list appears empty but should have data, confirm with a read-only `cscli` diagnostic (e.g. `cscli alerts list -o json`) that the data exists CrowdSec-side.

## 7. Timeouts

- **`timeout`** — the command exceeded `cscli.timeout`. Retry; if persistent, raise `cscli.timeout` (≤ 120s) and restart. Verify LAPI responsiveness.
- A single timeout is retryable; repeated timeouts on the same operation usually indicate an overloaded or unreachable LAPI rather than a dashboard fault.

## 8. CrowdSec failures

- **`crowdsec_failure`** — a non-zero exit with no more specific class. Use read-only `cscli` diagnostics to understand the CrowdSec-side cause. The dashboard never returns raw `stderr`.
- For **`decisions.add`**, an allowlist may be rejecting the target; the dashboard does not expose `--bypass-allowlist` (matrix §4). Adjust the target or the allowlist from CrowdSec's own tooling, not by bypassing the guard.
- For a **read**, confirm the target exists (an absent alert inspect target maps to a safe not-found).

## 9. When to escalate

Report a blocker rather than guessing when:

- A prerequisite artifact is missing or ambiguous (e.g. a matrix row whose support status is not recorded).
- A version-dependent operation is reported differently from what the installed CrowdSec supports.
- `cscli` diagnostics indicate a CrowdSec-side fault the dashboard cannot act on.

## 10. Non-goals

This troubleshooting guide does **not** cover, and does not provide shortcuts for: database backup/restore (REQ-046), monitoring platforms (REQ-043/044), notifications (REQ-045), containers/CI/CD (REQ-040–042), or multi-user identity (REQ-047/048). It also does not recommend destructive shortcuts (`--force`, `--all`, `--bypass-allowlist`), arbitrary flags, direct database access, or secret disclosure — those are outside the dashboard's supported operation boundary.