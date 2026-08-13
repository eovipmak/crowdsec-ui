# Task 05 — Remove the Scenarios / Profiles / Collections UI entirely

## Objective
The plan instructs: "=> Remove this section from the UI entirely." Delete the
`/scenarios` dashboard route, its subcomponents, the sidebar nav link, and
all client-side bindings that only the scenarios page used. The supporting
backend cscli operations (`scenarios.list`, `scenarios.inspect`,
`collections.list`, `hub.list`, `profiles.inspect`, `simulation.status`)
remain in the matrix and the backend adapter — only the dashboard UI entry
points are removed.

## Prerequisites/dependencies
None.

If any prerequisite is missing or ambiguous, stop, report the blocker with
the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 1. Fully independent of all other tasks (different files; no contract
dependency on task 02). Safe to run in parallel with task 01 (probe.go), task
02 (adapter types), task 03 (alerts UI), and task 04 (decisions UI).

The ONE shared file with other Wave-2 tasks is
`frontend/src/lib/api/types.ts` — but this task only REMOVES scenario/profile
types from it and does not edit the `AlertItem`/`DecisionItem`/>`AlertsListRequest`/`DecisionsListRequest`>
sections that tasks 02–04 own. To avoid merge conflicts, when editing
`types.ts` this task must only delete the scenario/profile/collection/hub/>simulation> simulation-related type blocks (`HubListRequest`, `ScenarioItem`,
`CollectionItem`, `ProfileItem`, `SimulationStatus`, and the capability
union members that reference `scenarios.*` / `collections.*` / `hub.list` /
`profiles.inspect` / `simulation.*`). Do NOT reformat adjacent
`AlertItem`/`DecisionItem` blocks.

## Owner
Next.js dashboard agent.

## Files and artifacts
- Delete `frontend/src/app/(dashboard)/scenarios/page.tsx`
- Delete `frontend/src/app/(dashboard)/scenarios/_components/scenarios-table.tsx`
- Delete `frontend/src/app/(dashboard)/scenarios/_components/collections-table.tsx`
- Delete `frontend/src/app/(dashboard)/scenarios/_components/hub-inventory.tsx`
- Delete `frontend/src/app/(dashboard)/scenarios/_components/profiles-view.tsx`
- Delete `frontend/src/app/(dashboard)/scenarios/_components/simulation-status-card.tsx`
  (and the entire `frontend/src/app/(dashboard)/scenarios/` directory once
  emptied).
- Modify `frontend/src/components/layout/dashboard-layout.tsx` — remove the
  `/scenarios` item from `NAV_ITEMS`.
- Modify `frontend/src/lib/api/client.ts` — remove the `listScenarios`,
  `listCollections`, `inspectProfiles`, `listHub`, `getSimulationStatus`
  method signatures and implementations ONLY IF they are exclusively used by
  the removed scenarios page. (See implementation steps for the "stop and
  report" rule if any are referenced elsewhere.)
- Modify `frontend/src/lib/api/requests.ts` — remove the
  `scenariosList`, `scenariosInspect`, `collectionsList`, `profilesInspect`,
  `hubList`, `simulationStatus` request builders IF the client methods above
  are removed. The `ScenariosInspectRequest` type import becomes an orphan
  and should be removed with its request builder.
- Modify `frontend/src/lib/api/types.ts` — remove the scenario/profile/
  collection/hub/simulation type blocks (`HubListRequest`, `ScenarioItem`,
  `CollectionItem`, `ProfileItem`, `SimulationStatus`, the capability union
  members `"scenarios.list" | "scenarios.inspect" | "collections.list" |
  "hub.list" | "profiles.inspect" | "simulation.status" |
  "simulation.enable" | "simulation.disable"`, and the unsupported-operation
  union members for the same). Do NOT touch `AlertItem` / `DecisionItem` /
  filter types — tasks 02–04 own them.
- Do NOT touch any `backend/**` file — the matrix and the backend adapter
  keep `scenarios.*` / `collections.*` / `hub.list` / `profiles.inspect` /
  `simulation.*` as supported or capability-gated operations; only the UI
  entry is removed. The backend routes `/api/v1/scenarios`, `/collections`,
  `/profiles`, `/simulation` may remain registered (the UI simply no longer
  calls them). Mention this in code comments where helpful.
- Do NOT touch `alerts/**` or `decisions/**` (other tasks own them).

## Implementation steps
1. Confirm the scenarios page and its components are only imported by
   themselves and by `dashboard-layout.tsx` (the nav link). Run a usages
   search for `listScenarios`, `listCollections`, `inspectProfiles`,
   `listHub`, `getSimulationStatus`, and the `scenarios/_components/*`
   imports before deleting anything. If ANY of these are referenced from a
   non-scenarios file (other than the api client/method tables), STOP and
   report the blocker — do not delete a method another page needs.
2. Delete the `frontend/src/app/(dashboard)/scenarios/` directory and all
   files inside it.
3. Remove the `NAV_ITEMS` entry whose `href === "/scenarios"` from
   `dashboard-layout.tsx`. Do not reorder the remaining items.
4. In `frontend/src/lib/api/client.ts` remove the method signatures from
   the `ApiClient` interface and the corresponding implementations in
   `apiClient`. Remove now-orphan imports at the top of the file
   (`HubListRequest`, etc.) — but only the ones that became unused as a
   direct result of this deletion. Do not remove imports still used by
   remaining methods (e.g. `CollectionResult` is shared).
5. In `frontend/src/lib/api/requests.ts` remove the
   `scenariosList`, `scenariosInspect`, `collectionsList`,
   `profilesInspect`, `hubList`, `simulationStatus` builders and the
   now-orphan type imports (`HubListRequest`,
   `ScenariosInspectRequest`, etc.).
6. In `frontend/src/lib/api/types.ts` remove the
   `HubListRequest`, `ScenarioItem`, `CollectionItem`, `ProfileItem`,
   `SimulationStatus` interfaces, and the capability union members for
   scenarios/collections/hub/profiles/simulation (both the supported/capability
   union AND the unsupported-operation union, to keep the union closed).
   Do NOT touch `AlertItem`, `DecisionItem`, `AlertsListRequest`,
   `DecisionsListRequest` — those belong to tasks 02–04 and may already be
   edited by them. Edit conservatively: only delete the specific scenario/
   profile/collection/hub/simulation blocks and the matching union members.
7. Verify the build: the Next.js router no longer has a `/scenarios` route,
   the sidebar no longer links to it, and TypeScript compiles with no
   references to deleted files.
8. Do NOT remove backend routes or adapter operations. The backend stays
   matrix-complete; only the UI entry points disappear.

## Contracts
- The dashboard no longer surfaces scenarios, profiles, collections, hub
  inventory, or simulation status. No page, no nav item, no API client
  method exists for them.
- The backend `/api/v1/scenarios`, `/api/v1/collections`, `/api/v1/profiles`,
  `/api/v1/simulation`, `/api/v1/hub` routes MAY remain (they are
  matrix-approved and adapter-backed). The UI simply does not call them.
- Capability response objects from `/api/v1/capabilities` MAY still list
  these operations; the remaining dashboard pages already ignore
  capability keys they do not render.
- The `AlertItem`/`DecisionItem`/<filter> types are untouched by this task.

## Acceptance criteria
- The `/scenarios` route folder does not exist; navigating to `/scenarios`
  in the dashboard is a 404 (or the Next.js NotFound).
- The sidebar has no "Scenarios / profiles / collections" link.
- No imports, client methods, or types reference `listScenarios`,
  `listCollections`, `inspectProfiles`, `listHub`, `getSimulationStatus`,
  `ScenarioItem`, `CollectionItem`, `ProfileItem`, `HubListRequest`, or
  `SimulationStatus` in `frontend/src/**` (except possibly inside
  `lib/api/types.ts` union literals that the build still keeps — those
  should be removed in step 6).
- `npm run lint`, `npm run typecheck`, `npm run format:check`, and
  `npm run build` all pass.
- Backend Go tests still pass (no backend change).

## Verification commands/checks
- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run format:check`
- `cd frontend && npm run build`
- `cd backend && go build ./... && go test ./...`
- Static search: `grep -rn "listScenarios\|listCollections\|inspectProfiles\|listHub\|getSimulationStatus\|/scenarios" frontend/src/` should return no hits except possibly backend-route references in comments.
- Manual: load the dashboard; confirm the sidebar no longer contains
  "Scenarios / profiles / collections"; navigating to `/scenarios` renders
  the Next.js 404.

## Reviewer
Next.js dashboard developer and Product Owner (the plan asks for full
removal; reviewer must confirm scope).

## Out of scope
- Removing the backend `scenarios.*` / `collections.*` / `hub.list` /
  `profiles.inspect` / `simulation.*` operations from the matrix or the
  adapter (the backend stays matrix-complete).
- Alerts/decisions UI changes (tasks 02–04).
- Metrics probe fix (task 01).
- New "configuration" replacement page — the plan says remove only.

## Coordinator status
- Status: completed
- Completed by: nextjs-dashboard agent (DeepSeek-V4-Flash-0731) + coordinator review
- Completed at: 2026-08-13T00:00:00Z
- Verification: `npm run lint`, `npm run typecheck`, `npm run build` all pass; `grep` for `listScenarios|listCollections|inspectProfiles|listHub|getSimulationStatus|/scenarios|ScenarioItem|CollectionItem|ProfileItem|HubListRequest|SimulationStatus|HubItem` in `frontend/src/` returns 0 hits (exit 1); `/scenarios` route absent from Next.js build output (12 routes, none is `/scenarios`); `scenarios/` directory removed; sidebar NAV_ITEMS no longer contains `/scenarios`; `cd backend && go build ./... && go test ./...` passes (backend untouched, matrix-complete).
- Commit or artifact reference: working tree (uncommitted). Modified: dashboard-layout.tsx, lib/api/{client,requests,types}.ts. Deleted: frontend/src/app/(dashboard)/scenarios/{page.tsx,_components/{scenarios-table,collections-table,hub-inventory,profiles-view,simulation-status-card}.tsx}.
