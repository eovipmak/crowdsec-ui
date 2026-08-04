# Task 04 — Implement the strict Go cscli execution adapter

## Objective
Implement the only integration boundary between the dashboard and CrowdSec.

## Prerequisites
Complete tasks 02 and 03.

## Owner
Go backend agent. Reviewers: Go backend developer and CrowdSec domain reviewer.

## Files and artifacts
- Add the Go module/package structure defined by task 01.
- Implement adapter types, operation dispatch, argument construction, process execution, parsing, and typed errors.
- Add focused adapter verification using a fake executable or injectable command runner.

## Work
1. Resolve the configured `cscli` executable path or controlled service-environment lookup.
2. Implement one internal operation handler per approved matrix operation.
3. Construct `exec.CommandContext` argument vectors internally; never invoke a shell or concatenate raw user input.
4. Validate operation parameters before execution, including bounds, enum values, IDs, filters, and mutation targets.
5. Capture stdout, stderr, exit status, context cancellation, timeout, and missing executable conditions.
6. Parse supported structured output into stable typed results and preserve safe diagnostic context.
7. Redact credentials, tokens, password material, and sensitive command output from logs and client-facing errors.

## Acceptance criteria
- Every implemented operation maps to a matrix entry.
- Invalid operations and parameter combinations fail before process execution.
- No API input can alter the executable path or add arbitrary flags.
- Command failures distinguish timeout, unavailable executable, invalid command, permission failure, and CrowdSec-reported failure.
- No database or shell dependency is introduced.

## Verification
- Exercise valid read and mutation operations with a fake `cscli` executable.
- Verify malformed parameters never start a process.
- Verify stderr/exit failures become stable safe errors.
- Search the implementation for shell invocation and raw command interpolation.

## Out of scope
HTTP routing, sessions, UI, packaging, systemd, and unsupported CrowdSec commands.
