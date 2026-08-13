# Task 01 — Repair metrics.show capability so the dashboard returns real data

## Objective
The statistics page returns `errUnsupported` with the message
"This CrowdSec installation does not support the requested operation" even
though `cscli metrics show`, `cscli metrics show bouncers`, and
`cscli metrics show -o json` all work on the host today. The capability probe
leaves `OpMetricsShow` at the conservative `CapabilityGated` default and the
API handler refuses to run unless it is `Supported`, so no metrics request can
ever succeed. Make the probe discover metrics support from the live cscli and
mark the operation `Supported` when the probe succeeds, mirroring how other
structured-output operations (alerts.list, decisions.list, …) are already
handled.

## Prerequisites/dependencies
None.

If any prerequisite is missing or ambiguous, stop, report the blocker with
the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 1. Independent of all other tasks in this kanban; the only owner of
`backend/internal/adapter/probe.go` capability logic for `OpMetricsShow`.

## Owner
Go cscli backend agent.

## Files and artifacts
- Modify `backend/internal/adapter/probe.go` (`runProbe`, the
  `OpMetricsShow` resolution block).
- Modify or add unit tests in `backend/internal/adapter/adapter_test.go`
  covering the new probed-supported case.
- Do NOT touch `backend/internal/api/handlers.go` behavior — the
  `handleMetricsShow` "Supported-only" gate stays in place; only the probe
  result changes.
- Do NOT change `backend/cmd/crowdsec-dashboard/main.go` wiring (the option
  is intentionally unset so the probe discovers support, the same way
  structured-output support is discovered).

## Implementation steps
1. Reproduce the bug: confirm `handleMetricsShow` short-circuits to
   `ErrUnsupported` because `s.capability(adapter.OpMetricsShow)` returns
   `CapabilityGated` (the conservative default) and the handler only allows
   `Supported`.
2. Inspect `backend/internal/adapter/probe.go`: the existing block
   ```
   if opts.supportsMetrics != nil { … } else { pr.capabilities[OpMetricsShow] = CapabilityGated }
   ```
   leaves metrics gated forever when the option is unset (which it always is
   in `main.go`).
3. Add a real probe so that when `opts.supportsMetrics == nil` the probe runs
   a safe, read-only cscli command and records `Supported` on success,
   `Unsupported` on failure. Use the cheap verified command shape
   `cscli metrics show -o json` (no component), matching the matrix §4
   `metrics.show` row. Do not run `metrics show bouncers` or any mutation.
4. Keep the existing `opts.supportsMetrics` override path intact so a future
   operator can force a known capability via config without changing probe
   behavior — when the override is set, the probe must NOT run an extra
   command (preserve current behavior).
5. Verify the probe command reuses the existing `probeCommand` / short
   `probeTimeout` (5s) helpers; never introduce a new exec path.
6. Update adapter unit tests (and a probe test if present) to assert that
   with the override unset and the probe runner succeeding, the resulting
   `probeResult.capabilities[OpMetricsShow] == Supported`; with the probe
   runner failing, it is `Unsupported` (NOT `CapabilityGated` — the
   `CapabilityGated` placeholder is exactly what produced this bug).
7. Do not introduce a new OperationID, a new flag, or a new typed request;
   the matrix row and the `MetricsShowRequest` enum (`acquisition|appsec|lapi`)
   are unchanged.

## Contracts
- The pipeline from API to adapter must now be able to deliver real metrics
  JSON when cscli supports it: `handleMetricsShow` still rejects everything
  that is not `Supported`, but the probe now reports `Supported` on a
  successful live probe.
- The probe must be read-only, time-bounded, and never run during request
  handling — only at adapter construction.
- Failure modes are mapped honestly: missing/disabled Prometheus config
  returns `Unsupported` (was `CapabilityGated`); a non-zero exit or malformed
  output returns `Unsupported`. The dashboard surfaces this as the existing
  `unsupported` envelope (matrix-row `metrics.show` row notes).
- No new env vars, no new config keys; `supportsMetrics` override behavior is
  unchanged.

## Acceptance criteria
- With cscli present and metrics working (verified manually on the host),
  `GET /api/v1/metrics/{component}` returns 200 with a non-empty
  section-keyed JSON payload (e.g. `lapi`, `acquisition`, `appsec`).
- With no cscli or a failing metrics command, the same endpoint returns the
  existing `unsupported` matrix error and the dashboard overview renders the
  "statistics not supported" state — no crash, no `CapabilityGated` left in
  the capabilities response.
- `go test ./backend/internal/adapter/...` passes; new test cases cover the
  probed-supported and probe-unsupported paths.
- No other operation's capability changes as a side effect (alerts/decisions
  lists, machines, bouncers, scenarios, collections, allowlists must keep
  their current `Supported` pipeline).

## Verification commands/checks
- `gofmt -l backend/` (must be empty)
- `go vet ./backend/...`
- `go build ./backend/...`
- `go test ./backend/internal/adapter/...`
- Manual: start the dashboard, `curl -s :<port>/api/v1/metrics/lapi` while
  authenticated, and confirm a JSON body (not the unsupported error)
  on the host with cscli.
- `grep -n "CapabilityGated" backend/internal/adapter/probe.go` — confirm
  `OpMetricsShow` is no longer left at `CapabilityGated` when the override is
  unset and the probe succeeds or fails.

## Reviewer
Go backend developer and Security reviewer.

## Out of scope
- Changing the `metrics.show` matrix row, the component enum, or
  `MetricsShowRequest`.
- Frontend metrics/overview rendering changes.
- Changing the API handler gate.
- Adding new metrics components or a Prometheus integration.
- Any change to scenarios/profiles/collections removal (task 05) or
  alerts/decisions contracts (task 02).

## Coordinator status
- Status: not started
- Completed by: <agent name>
- Completed at: <timestamp>
- Verification: <summary of checks run>
- Commit or artifact reference: <commit SHA or file list>
