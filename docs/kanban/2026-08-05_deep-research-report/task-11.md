# Task 11 — Package native Linux execution and systemd deployment

## Objective
Make the dashboard installable and operable as a native Linux binary with optional systemd supervision.

## Prerequisites/dependencies
Complete tasks 05–07 and task 06.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 6. Can run in parallel with tasks 08–10; deployment paths must follow the backend/frontend contracts and must not modify page implementations.

## Owner
Native deployment agent.

## Files and artifacts
- Add reproducible Linux build/package instructions.
- Add sample configuration with safe non-secret placeholders.
- Add install directory and frontend asset layout.
- Add systemd unit, service account guidance, and permission instructions.
- Update deployment documentation with direct-execution and systemd workflows.

## Implementation steps
1. Package the Go binary and built frontend assets without Docker or Podman.
2. Configure executable path, optional CrowdSec config path, bind address, port, config path, logging, and session settings.
3. Default binding to localhost or a trusted internal interface; document HTTPS responsibility when crossing an untrusted network.
4. Define dedicated directories and restricted ownership/modes for configuration and assets.
5. Run under the least-privileged service account capable of required `cscli` operations; do not assume root.
6. Configure systemd start, stop, restart, update, failure behavior, and logs.

## Contracts
- Native packaging paths, service configuration, and systemd behavior must agree with the backend and frontend asset contracts while preserving least privilege.
- Any optional CrowdSec configuration path is limited to the approved read-only profiles reader and is never an arbitrary configuration-editing or command-execution path.
- Deployment documentation must identify capability-gated/version-dependent operations and the pending CrowdSec-domain sign-off requirement.
- The service account receives only permissions needed for supported operations; unsupported mutations must not drive additional privileges.

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

## Reviewer
Native deployment operator.

## Out of scope
Cloud deployment, containers, Kubernetes, automated release pipelines, TLS termination, backups, and external monitoring.

## Coordinator status
- Status: completed
- Completed by: Native deployment agent (coordinator-reviewed; coordinator resolved the shared-config blocker the agent introduced — `output: "export"` in `next.config.ts` vs `icon.tsx`'s `next/og` `ImageResponse` — by replacing `icon.tsx` with a static `icon.svg` so the static export builds and embeds cleanly)
- Completed at: 2026-08-12T14:35:00Z
- Verification: `gofmt -l backend/` empty; `go vet ./...`, `go build ./...`, `go test ./...` all passed. `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` all passed in `frontend/` (13 static routes; `/icon.svg` discovered via App Router auto-discovery, exported to `frontend/out/`). `backend/build.sh /tmp/crowdsec-dashboard-smoketest` succeeded end-to-end (frontend build → staged into `backend/internal/assets/bundle/` → Go binary, 8.3M, CGO_ENABLED=0). Binary smoke test: started with a sample config (real bcrypt hash, bind `127.0.0.1:18090`); `GET /` → HTTP 200 + real dashboard HTML (6544 bytes, Next.js bundle — NOT the "assets not bundled" placeholder); `GET /api/v1/health` → 200; `GET /api/v1/<unknown>` → 404; `GET /_next/static/...` → 200. `systemd-analyze verify deploy/crowdsec-dashboard.service` reported only the expected pre-install warning (binary not yet at `/usr/local/bin/`) — unit syntax is valid. `git diff --check` clean. Static search confirms no `os/exec`/shell invocation in `backend/internal/assets` or `backend/internal/api` (exec owned by the adapter per architecture §3). Packaging uses native Go + Node.js tooling only — no Docker, no Podman, no CI/CD, no database, no monitoring artifacts.
- Commit or artifact reference: backend/internal/assets/assets.go, backend/internal/assets/bundle/ (embedded), backend/cmd/crowdsec-dashboard/main.go (surgical: `Assets: api.NewAssetHandler(assets.Forward)`), backend/build.sh, deploy/config.example.yaml, deploy/crowdsec-dashboard.service, deploy/install/README.md, frontend/next.config.ts (`output: "export"`), frontend/src/app/icon.svg (replaces icon.tsx); working tree
