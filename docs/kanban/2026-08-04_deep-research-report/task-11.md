# Task 11 — Package native Linux execution and systemd deployment

## Objective
Make the dashboard installable and operable as a native Linux binary with optional systemd supervision.

## Prerequisites
Complete tasks 05–07 and task 06.

## Owner
Native deployment agent. Reviewer: Native deployment operator.

## Files and artifacts
- Add reproducible Linux build/package instructions.
- Add sample configuration with safe non-secret placeholders.
- Add install directory and frontend asset layout.
- Add systemd unit, service account guidance, and permission instructions.
- Update deployment documentation with direct-execution and systemd workflows.

## Work
1. Package the Go binary and built frontend assets without Docker or Podman.
2. Configure executable path, optional CrowdSec config path, bind address, port, config path, logging, and session settings.
3. Default binding to localhost or a trusted internal interface; document HTTPS responsibility when crossing an untrusted network.
4. Define dedicated directories and restricted ownership/modes for configuration and assets.
5. Run under the least-privileged service account capable of required `cscli` operations; do not assume root.
6. Configure systemd start, stop, restart, update, failure behavior, and logs.

## Acceptance criteria
- A clean Linux installation can follow the documentation to start the service and serve assets.
- Runtime config, systemd unit, and binary agree on paths and flags.
- Config permissions are restricted and secrets are not embedded in packages or unit files.
- Bind defaults do not unintentionally expose the service.
- No container, CI/CD, database, or monitoring artifacts are added.

## Verification
- Build the Linux binary and run it with sample configuration.
- Validate package paths, file ownership/modes, systemd syntax, startup, shutdown, restart, and update procedures.
- Verify the service can invoke required commands with minimum permissions.

## Out of scope
Cloud deployment, containers, Kubernetes, automated release pipelines, TLS termination, backups, and external monitoring.
