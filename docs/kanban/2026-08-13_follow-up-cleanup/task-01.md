# Task 01 — Reformat `machines-table.tsx` to clear `npm run format:check` drift

## Objective

`npm run format:check` fails on exactly one file across the frontend:
`frontend/src/app/(dashboard)/machines/_components/machines-table.tsx`.
The drift is whitespace/formatting only (pre-existing; not introduced by
the debug-and-fix kanban — the T03/T04 subagents confirmed via `git
status` that this file was outside their allowed-list and was therefore
left untouched). This task runs Prettier `--write` on the single file,
then verifies the whole frontend is now green and the diff is mechanical.

Re-verified this session:

```
$ cd frontend && npx prettier --check "src/app/(dashboard)/machines/_components/machines-table.tsx"
[warn] src/app/(dashboard)/machines/_components/machines-table.tsx
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```

## Prerequisites/dependencies

None.

If any prerequisite is missing or ambiguous, stop, report the blocker with
the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 1. Fully independent of task 02 (`frontend/src/lib/api/types.ts`) and
task 03 (`backend/internal/assets/assets.go`). Different file, different
ecosystem tool. Safe to run in parallel with both.

## Owner

Next.js dashboard agent (or any agent with frontend tooling access).

## Files and artifacts

- `frontend/src/app/(dashboard)/machines/_components/machines-table.tsx` —
  Prettier reformat (whitespace/formatting only).
- Do NOT touch any other `frontend/**` file. Do NOT touch `backend/**`.
- Do NOT regenerate the Next.js build, `_next/`, or any other artifact.

## Implementation steps

1. From the repository root, run Prettier `--write` on the single file:

   ```bash
   cd frontend
   npx prettier --write "src/app/(dashboard)/machines/_components/machines-table.tsx"
   ```

2. Inspect the resulting diff to confirm it is formatting-only (no logic
   change, no renamed identifiers, no removed JSX, no reordered imports
   beyond what Prettier emits). Use:

   ```bash
   cd /root/crowdsec-ui
   git diff --stat -- frontend/src/app/\(dashboard\)/machines/_components/machines-table.tsx
   git diff -- frontend/src/app/\(dashboard\)/machines/_components/machines-table.tsx
   ```

   If any hunk rewrites logic (it should not), STOP and report the
   unexpected change — do not commit a logic edit disguised as formatting.

3. Do NOT independently hand-edit the file. Prettier is the only allowed
   editor for this task.

## Contracts

- The component's rendered output, props, hooks, and behavior are
  unchanged. Only whitespace/line-wrapping changes are acceptable.
- `MachinesTable` still imports the same modules and exports the same
  symbol.

## Acceptance criteria

- `npx prettier --check "src/app/(dashboard)/machines/_components/machines-table.tsx"`
  exits 0 with no `[warn]` line for that file.
- `npm run format:check` (whole frontend) now prints
  `All matched files use Prettier code style!` and exits 0.
- `git diff --stat` for the file shows only this single file changed.
- The diff hunks are mechanical (indentation, line wrapping, trailing
  commas, JSX attribute layout) — no identifier, prop, or hook changes.

## Verification commands/checks

```bash
cd frontend
npx prettier --check "src/app/(dashboard)/machines/_components/machines-table.tsx"
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Expected: all pass; `format:check` reports `All matched files use
Prettier code style!`.

```bash
cd /root/crowdsec-ui
git diff --stat -- frontend/src/app/\(dashboard\)/machines/_components/machines-table.tsx
```

Expected: exactly one file changed; the hunk is whitespace/formatting only.

## Reviewer

Next.js dashboard developer.

## Out of scope

- Any logic change inside `machines-table.tsx` (column order, rendering,
  hooks, props).
- Editing any other `frontend/**` file, including `types.ts` (owned by
  task 02) and any other table component.
- Running Prettier across the whole codebase (`--write` on `**`); only the
  single file may be reformatted.
- Any backend change (task 03 owns the only backend file in this kanban).
- Regenerating `backend/internal/assets/bundle/` or running
  `backend/build.sh`.

## Coordinator status

- Status: completed
- Completed by: nextjs-dashboard agent (delegated) + coordinator verification
- Completed at: 2026-08-13T14:01:14Z
- Verification: Coordinator re-ran authoritative checks (not relying on agent claim):
  - `npx prettier --check` on the single file → exit 0, "All matched files use Prettier code style!".
  - `npm run format:check` → exit 0, "All matched files use Prettier code style!".
  - `npm run lint` → exit 0.
  - `npm run typecheck` → exit 0.
  - `npm run build` (cold `.next/`) → exit 0; 10 routes statically exported, `✓ Exporting (2/2)`.
  - `git diff --stat` for the file → `1 file changed, 1 insertion(+), 2 deletions(-)`.
  - Diff is a single mechanical line-collapse of a short ternary arrow-body
    (`render: (row) => row.last_heartbeat ? ... : "—"`); no identifier/prop/hook/import change.
- Commit or artifact reference: working tree (not committed).
