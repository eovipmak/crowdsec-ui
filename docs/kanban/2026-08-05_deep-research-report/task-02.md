# Task 02 — Produce and validate the cscli command matrix

## Objective
Create the authoritative command matrix that all backend and frontend work must implement.

## Prerequisites/dependencies
Complete task 01.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it. The deployment environment or official CrowdSec documentation must be available for command verification.

## Parallelization

Wave 2. Starts after task 01; no file conflict with later implementation tasks.

## Owner
CrowdSec command-mapper agent.

## Files and artifacts
- Create a command-matrix document under `docs/`.
- Define typed operation names and request/response shapes for backend consumers.
- Do not implement handlers or UI controls in this task.

## Implementation steps
For alerts, decisions, machines/status, scenarios, profiles, collections, allowlists, bouncers, and optional metrics, document:
- operation identifier and exact `cscli` argument vector;
- supported structured output format and parsing rules;
- allowed parameters, validation, filter translation, and pagination behavior;
- read versus mutation classification;
- confirmation requirement and expected source-of-truth refresh;
- expected exit codes/failure classes and safe client-facing messages;
- required permissions and whether support is environment-dependent.

Explicitly decide whether decision add/delete and component enable/disable belong to the MVP. Mark unsupported operations instead of inventing fallback commands. State that browser input can select typed operation parameters only and can never supply shell fragments, executable paths, or arbitrary flags.

## Contracts
- `docs/command-matrix.md` is the sole operation allowlist and must define one typed row per supported, capability-gated, or explicitly unsupported operation.
- Each row must specify the fixed argument vector, typed parameters, output/parser contract, exact page mode (`limit`, `offset`, `cursor`, or `none`), permission, failure classes, mutation confirmation, and source-of-truth refresh.
- Browser input may select typed operation parameters only; it may never provide command text, executable paths, raw flags, shell fragments, filesystem paths, or arbitrary filters.
- The matrix must distinguish MVP-supported/capability-gated operations from documented-but-unsupported rows. The profiles exception, if retained, is a separate read-only server-side profiles-file boundary and not a `cscli` command.
- Target-environment verification and CrowdSec-domain sign-off are completion gates for version-dependent rows.

## Acceptance criteria
- Every API operation maps to one matrix row and every matrix row has a named consumer.
- Unsupported or version-dependent operations are explicit.
- Mutating operations identify their effect and confirmation rule.
- Parameters are constrained enough for an adapter agent to construct argument vectors without guessing.
- CrowdSec reviewer signs off.

## Verification
- Compare each command against the target environment or official command behavior.
- Review all parameters for shell injection and unintended destructive combinations.
- Confirm output schemas cover empty, malformed, unsupported, and command-failure cases.

## Reviewer
CrowdSec domain reviewer and Backend Developer. CrowdSec-domain sign-off is required for completion.

## Out of scope
HTTP routes, UI design, authentication, direct database queries, Prometheus/Grafana integration, and arbitrary command passthrough.

## Coordinator status
- Status: completed
- Completed by: CrowdSec command-mapper agent
- Completed at: 2026-08-08T04:00:00Z
- Verification: Live CrowdSec v1.7.8 read-only probes passed for alerts, decisions, machines, bouncers, scenarios, collections, hub, metrics, LAPI, CAPI, and simulation; `git diff --check` passed. Mutation probes were intentionally not run to avoid changing CrowdSec state.
- Commit or artifact reference: docs/command-matrix.md; working tree
- Blocker: CrowdSec-domain reviewer sign-off is still required by the task acceptance criteria; mutation behavior and target-environment sign-off remain pending.

