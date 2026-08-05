# Task 08 — Implement overview, machines, status, and statistics views

## Objective
Provide the administrator with a source-of-truth overview of CrowdSec health and current counts.

## Prerequisites/dependencies
Complete tasks 05 and 07.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 6. Can run in parallel with tasks 09, 10, and 11; keep ownership limited to overview/machines/statistics files.

## Owner
Next.js dashboard agent. Reviewer: Next.js dashboard developer and CrowdSec domain reviewer.

## Files and artifacts
- Implement overview page and its data-fetching components.
- Implement machines/status sections.
- Add optional alert/decision history charts only when supported by the matrix/API.

## Implementation steps
1. Fetch status, machines, alert counts, decision counts, and approved metrics independently so one failure does not hide all data.
2. Display timestamps/source labels and clear loading, empty, unsupported, and command-failure states.
3. Add explicit refresh and bounded polling behavior consistent with task 03.
4. Render small internal charts only from approved `cscli` data and label unavailable history honestly.
5. Provide links from summary cards to detailed pages.

## Contracts
- Overview data comes from independent current API responses for each approved operation; no local source-of-truth copy or implied real-time stream is introduced.
- Rendering honors each operation's declared page mode and does not invent cursor, offset, counts, history, or pagination where the matrix reports `none`.
- Optional or unsupported metrics and status operations are displayed as unavailable/unsupported rather than treated as unexplained failures.
- Every successful mutation elsewhere refreshes the matrix-defined source-of-truth operation before summary views claim updated state.

## Acceptance criteria
- Overview never claims real-time or monitoring-platform behavior.
- Data shown comes from current API responses, not a duplicated local store.
- Each failed operation identifies its affected section and offers refresh.
- Machine/status views reflect the command matrix and handle empty results.

## Verification
- Test success, empty, unsupported, timeout, and permission-error responses.
- Verify refresh/polling does not create unbounded requests.
- Confirm charts are absent or clearly unavailable when matrix data is insufficient.

## Reviewer
Next.js dashboard developer and CrowdSec domain reviewer.

## Out of scope
Prometheus/Grafana, notifications, streaming, historical storage, and backend command changes.
