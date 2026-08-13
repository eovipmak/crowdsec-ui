# Plan — Post debug-and-fix follow-up cleanup

## 1. Overview

The debug-and-fix kanban (`docs/kanban/2026-08-13_debug-and-fix`) landed
all five tasks with verified completion markers. Three cosmetic drifts were
intentionally left untouched because they were outside the allowed-file
scope of the in-flight tasks. This plan closes those drifts so the repo's
verification commands (`gofmt`, `npm run format:check`) turn fully green.

Scope is small and surgical: one prettier reformat, one gofmt comment-block
move, and two dead interface removals. No behavior changes.

## 2. Background and motivation

All three items were reported as *Remaining risks / follow-up* in the
debug-and-fix completion report:

| # | Item | File | Symptom |
|---|------|------|---------|
| 1 | Pre-existing `npm run format:check` drift | `frontend/src/app/(dashboard)/machines/_components/machines-table.tsx` | Subagents for T03/T04 reported `format:check` only ever failing on this file, which neither task owned. |
| 2 | Orphan filter-values interfaces | `frontend/src/lib/api/types.ts` (`AlertFilterValues`, `DecisionFilterValues`) | Still declare `scope`/`kind`/`origin` even though tasks 02/04 removed these from `AlertsListRequest`/`DecisionsListRequest`. Imported nowhere. |
| 3 | Pre-existing `gofmt` drift in embedded-bundle host | `backend/internal/assets/assets.go` | `go:embed` directive separated from the `var` by a comment block; gofmt wants the directive adjacent to the declaration. |

Because each task in the kanban was scoped narrowly to preserve
independence, none of them could touch these files. This follow-up plan
owns the three files explicitly.

## 3. Evidence (verified before writing this plan)

### 3.1 Prettier drift on `machines-table.tsx`

`docs/kanban/2026-08-13_debug-and-fix/{task-03.md,task-04.md}` both record
the subagent's finding that `npm run format:check` fails on
`frontend/src/app/(dashboard)/machines/_components/machines-table.tsx`
alone and no other file. The T03 subagent confirmed via `git status` that
this file was not in its allowed-file set, so it was left untouched per the
"Do NOT touch any file outside the allowed list" constraint.

### 3.2 Orphan interfaces in `types.ts`

Re-verified this session:

```
$ grep -rn "AlertFilterValues\|DecisionFilterValues" frontend/src/
frontend/src/lib/api/types.ts:386:export interface AlertFilterValues {
frontend/src/lib/api/types.ts:393:export interface DecisionFilterValues {
```

Both interfaces are declared in `types.ts` (L386, L393) and appear nowhere
else in `frontend/src/**`. They are not imported by any component, hook, or
client module. Current contents:

```ts
export interface AlertFilterValues {
  scenario?: string;
  ip?: string;
  scope?: string;   // removed from AlertsListRequest by task 02
  kind?: string;    // removed from AlertsListRequest by task 02
}

export interface DecisionFilterValues {
  ip?: string;
  scope?: string;   // removed from DecisionsListRequest by task 02
  type?: string;
  origin?: string;  // removed from DecisionsListRequest by task 02
  scenario?: string;
}
```

These duplicate (and contradict) the live filter contract that task 02/04
already published on `AlertsListRequest["filter"]`/`DecisionsListRequest["filter"]`,
so leaving them in place is a source of confusion for future contributors.

### 3.3 gofmt drift on `assets.go`

Re-verified this session with `gofmt -d`:

```
$ gofmt -d backend/internal/assets/assets.go
--- backend/internal/assets/assets.go.orig
+++ backend/internal/assets/assets.go
@@ -18,8 +18,6 @@
        "io/fs"
 )

-//go:embed all:bundle
-//
 // The "all:" prefix is required because Next.js emits its static export
 // under a "_next/" directory whose name begins with an underscore. Go's
@@ -31,6 +29,8 @@
 // filters) fell back to native HTML form GET, leaking the password into
 // the URL bar. "all:" is safe here because the bundle is a controlled,
 // build-time produced static export containing only public assets.
+//
+//go:embed all:bundle
 var bundleFS embed.FS
```

Cause: Go requires a `//go:embed` directive to be on the line immediately
preceding (with no blank line in between) the `var` it embeds. The current
file has the directive above a multi-line explanatory comment, so gofmt
moves it to just above the declaration. The fix is to relocate the
`//go:embed all:bundle` directive to be the line immediately before
`var bundleFS embed.FS`, keeping the explanatory comment block above it.

## 4. Solution

### 4.1 Reformat `machines-table.tsx`

Run prettier on the single file:

```bash
cd frontend
npx prettier --write "src/app/(dashboard)/machines/_components/machines-table.tsx"
```

Then re-run `npm run format:check` to confirm the whole frontend is now
green (no drift in any file). Inspect the diff `git diff --stat` to
confirm the change is whitespace/formatting only (no logic change). If
prettier rewrites logic (it should not), review each hunk before
committing.

### 4.2 Remove orphan interfaces from `types.ts`

Delete the `AlertFilterValues` and `DecisionFilterValues` interface
declarations (L386–L397 inclusive, including the trailing blank line) from
`frontend/src/lib/api/types.ts`. They are exported but used by nothing.

Do NOT touch `AlertsListRequest["filter"]`, `DecisionsListRequest["filter"]`,
`alertsListParams`, or `decisionsListParams` — those are the live contract
from tasks 02/04 and already match the contract.

### 4.3 Fix `//go:embed` directive placement in `assets.go`

Move the `//go:embed all:bundle` directive so it directly precedes
`var bundleFS embed.FS` (no blank line between them) and place the
explanatory comment block above the directive. Target layout:

```go
        "io/fs"
)

// The "all:" prefix is required because Next.js emits its static export
// under a "_next/" directory whose name begins with an underscore. Go's
// `//go:embed` directive excludes files and directories whose names begin
// with `.` or `_` by default (treating them as private), so without the
// `all:` prefix the entire "_next" tree (JS chunks, CSS, build/SSG
// manifests, hashed route bundles) would be silently dropped from the
// embedded FS. Without those chunks the browser could not hydrate the
// exported pages and any JS-driven form submission (login, mutations,
// filters) fell back to native HTML form GET, leaking the password into
// the URL bar. "all:" is safe here because the bundle is a controlled,
// build-time produced static export containing only public assets.
//
//go:embed all:bundle
var bundleFS embed.FS
```

After the edit, `gofmt -d backend/internal/assets/assets.go` must produce
no output.

## 5. Files and artifacts

| Path | Change |
|------|--------|
| `frontend/src/app/(dashboard)/machines/_components/machines-table.tsx` | Prettier reformat (whitespace only). |
| `frontend/src/lib/api/types.ts` | Delete `AlertFilterValues` (L386–L389) and `DecisionFilterValues` (L393–L399) interface blocks. |
| `backend/internal/assets/assets.go` | Relocate `//go:embed all:bundle` directive directly above `var bundleFS`. |

No new files, no new dependencies, no behavior changes.

## 6. Verification

Run every check sequentially and confirm green before declaring done:

### 6.1 Frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Expected: all pass. `format:check` was the previously-failing check; it
must now report *All matched files use Prettier code style!* with zero
files flagged. `typecheck` must still pass after removing the two unused
interfaces (they are exported but unreferenced, so deletion is safe —
TypeScript does not error on removing an unused exported interface).

### 6.2 Backend

```bash
cd backend
gofmt -l .                         # must print nothing
go vet ./...
go build ./...
go test ./...
```

Expected: all pass. `gofmt -l .` was the previously-failing check; it must
now report zero files (including `internal/assets/assets.go`). The build
must succeed because the embed directive is still present and valid; only
its position within the comment block changes.

### 6.3 Static confirmation of orphan removal

```bash
grep -rn "AlertFilterValues\|DecisionFilterValues" frontend/src/
```

Expected: no matches (exit 1).

### 6.4 No behavior change

Confirm the affected files still compile and the routes still exist:

```bash
cd frontend && npm run build 2>&1 | grep -E "/alerts|/decisions|/machines"
cd backend && go build ./...
```

Expected: `/alerts`, `/decisions`, `/machines` remain in the Next.js route
output; the Go binary builds successfully.

## 7. Out of scope

- Any change to `AlertsListRequest["filter"]` / `DecisionsListRequest["filter"]`
  or the `*ListParams` query builders — those belong to the task-02/04
  contract.
- Any logic change inside `machines-table.tsx` (column order, rendering,
  hooks). Prettier may only reformat whitespace.
- Refactoring the embed comment block prose; only the directive position
  changes.
- Regenerating the embedded `bundle/` directory or running
  `backend/build.sh` — the embed directive is valid regardless of whether
  the bundle is present.
- Any backend route, adapter operation, matrix row, or capability gating.
- Any change to `alert-detail.tsx` or `alerts-table.tsx` beyond what was
  already done in the debug-and-fix kanban.

## 8. Acceptance criteria

- `npm run format:check` prints `All matched files use Prettier code style!`
  and exits 0.
- `gofmt -l backend/.` prints nothing (zero files).
- `grep -rn "AlertFilterValues\|DecisionFilterValues" frontend/src/` returns
  no matches.
- `npm run lint`, `npm run typecheck`, `npm run build`,
  `go vet ./...`, `go build ./...`, `go test ./...` all pass.
- The diff for each file is mechanical (formatting / directive position /
  interface deletion), with no logic edit.
