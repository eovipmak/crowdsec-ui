# Task 01 — Establish MVP requirements and repository foundation

## Objective
Turn `docs/plans/deep-research-report.md` into an implementation-ready MVP baseline and establish the repository boundaries used by later agents.

## Prerequisites
None.

## Owner
Product/architecture agent.

## Files and artifacts
- Create or update the requirements document under `docs/`.
- Establish the agreed source directories for Go backend, Next.js frontend, configuration, assets, deployment, and documentation.
- Do not create implementation code unless required to establish the scaffold.

## Implementation steps
1. State the product goal: an internal dashboard on the CrowdSec host for one administrator.
2. Define the source-of-truth rule: CrowdSec is accessed only through approved `cscli` commands; no CrowdSec database access and no application database.
3. Define MVP pages: overview, alerts, decisions, machines/status, scenarios/profiles/collections, allowlists, bouncers, and login.
4. Record selected technologies: Go `net/http`, `os/exec`, Next.js, TypeScript, Tailwind CSS, native Linux packaging.
5. Record explicit exclusions: Docker, Podman, Kubernetes, CI/CD, Grafana, Prometheus integration, notifications, backups, multi-user/RBAC, LDAP/OIDC, and separate databases.
6. Assign later work to backend, frontend, security, deployment, and documentation boundaries.

## Contracts
- `docs/requirements.md` is the normative MVP baseline and must remain consistent with the source plan.
- CrowdSec remains the source of truth; no application database, direct CrowdSec database access, arbitrary command execution, or out-of-scope infrastructure may be introduced.
- The repository ownership map must assign every later artifact to one task and preserve the agreed Go backend, Next.js frontend, configuration, assets, deployment, and documentation boundaries.

## Acceptance criteria
- Requirements are testable and identify all MVP pages and mutations as conditional on the command matrix.
- Architecture and scope constraints are explicit and cannot be interpreted as permission to add a database or arbitrary command execution.
- Later tasks have clear module/artifact ownership.

## Verification
- Check every report section against the requirements document.
- Confirm every planned feature has a later task and every excluded feature is absent from implementation scope.

## Reviewer
Product Owner and Development Lead.

## Out of scope
Command discovery, backend code, frontend behavior, authentication implementation, packaging, and operational procedures.
