# Task 04 — Implement the strict Go cscli execution adapter

## Objective
Implement the only integration boundary between the dashboard and CrowdSec.

## Prerequisites/dependencies
Complete tasks 02 and 03.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 4. Can run in parallel with task 07 after tasks 02–03; do not modify frontend files.

## Owner
Go backend agent.

## Files and artifacts
- Add the Go module/package structure defined by task 01.
- Implement adapter types, operation dispatch, argument construction, process execution, parsing, and typed errors.
- Add focused adapter verification using a fake executable or injectable command runner.

## Implementation steps
1. Resolve the configured `cscli` executable path or controlled service-environment lookup.
2. Implement one internal operation handler per approved matrix operation.
3. Construct `exec.CommandContext` argument vectors internally; never invoke a shell or concatenate raw user input.
4. Validate operation parameters before execution, including bounds, enum values, IDs, filters, and mutation targets.
5. Capture stdout, stderr, exit status, context cancellation, timeout, and missing executable conditions.
6. Parse supported structured output into stable typed results and preserve safe diagnostic context.
7. Redact credentials, tokens, password material, and sensitive command output from logs and client-facing errors.

## Contracts
- The adapter implements only MVP-supported or capability-gated matrix operations; rows explicitly marked unsupported receive no executable handler.
- Argument vectors are constructed internally from validated typed parameters and run directly with `exec.CommandContext`; no shell, interpolation, arbitrary flags, or browser-controlled executable path is allowed.
- Capability probing covers structured output, version-dependent filters/pagination, `machines.prune`, conditional `bouncers.delete`, optional metrics, and optional CAPI status. Unsupported capability is reported as `unsupported`.
- Empty collections return typed `items: []`; malformed JSON/raw output maps to `malformed_output`; failures map to stable safe error classes; successful mutations perform the matrix-defined refresh.
- `profiles.inspect`, if retained, is implemented as a separate approved read-only configuration-reader boundary, not as a `cscli` adapter operation.

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

## Reviewer
Go backend developer and CrowdSec domain reviewer.

## Out of scope
HTTP routing, sessions, UI, packaging, systemd, and unsupported CrowdSec commands.
