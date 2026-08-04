# Task 02 — Produce and validate the cscli command matrix

## Objective
Create the authoritative command matrix that all backend and frontend work must implement.

## Prerequisites
Complete task 01. The deployment environment or official CrowdSec documentation must be available for command verification.

## Owner
CrowdSec command-mapper agent. Reviewers: CrowdSec domain reviewer and Backend Developer.

## Files and artifacts
- Create a command-matrix document under `docs/`.
- Define typed operation names and request/response shapes for backend consumers.
- Do not implement handlers or UI controls in this task.

## Work
For alerts, decisions, machines/status, scenarios, profiles, collections, allowlists, bouncers, and optional metrics, document:
- operation identifier and exact `cscli` argument vector;
- supported structured output format and parsing rules;
- allowed parameters, validation, filter translation, and pagination behavior;
- read versus mutation classification;
- confirmation requirement and expected source-of-truth refresh;
- expected exit codes/failure classes and safe client-facing messages;
- required permissions and whether support is environment-dependent.

Explicitly decide whether decision add/delete and component enable/disable belong to the MVP. Mark unsupported operations instead of inventing fallback commands. State that browser input can select typed operation parameters only and can never supply shell fragments, executable paths, or arbitrary flags.

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

## Out of scope
HTTP routes, UI design, authentication, direct database queries, Prometheus/Grafana integration, and arbitrary command passthrough.
