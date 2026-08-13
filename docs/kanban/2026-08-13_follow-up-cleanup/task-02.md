# Task 02 — Remove orphan `AlertFilterValues` / `DecisionFilterValues` interfaces from `types.ts`

## Objective

`frontend/src/lib/api/types.ts` still exports two filter-shape interfaces
that contradict the live contract published by tasks 02/04 of the
debug-and-fix kanban. They are imported by nothing and they declare the
very fields (`scope`/`kind` for alerts, `scope`/`origin` for decisions)
that the kanban removed from `AlertsListRequest` / `DecisionsListRequest`.
Leaving them in place is a source of confusion for future contributors;
this task deletes the two interface blocks.

Re-verified this session:

```
$ grep -rn "AlertFilterValues\|DecisionFilterValues" frontend/src/
frontend/src/lib/api/types.ts:386:export interface AlertFilterValues {
frontend/src/lib/api/types.ts:393:export interface DecisionFilterValues {
```

Both names appear only in their own declarations (L386 and L393 of
`types.ts`) and nowhere else in `frontend/src/**`. They are not imported
by any component, hook, or client module.

Current contents (verified):

```ts
// ---------------------------------------------------------------------------
// Query parameter builders (architecture §6.1)
// ---------------------------------------------------------------------------

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

function appendQuery(
  params: URLSearchParams,
  ...
```

The live filter contract lives on `AlertsListRequest["filter"]` and
`DecisionsListRequest["filter"]` (and the `alertsListParams` /
`decisionsListParams` builders below `appendQuery`). Those are owned by
the debug-and-fix contract and MUST NOT be touched.

## Prerequisites/dependencies

None. The two interfaces are dead state that the debug-and-fix contract
already replaced; removing them is a deletion-only cleanup.

If any prerequisite is missing or ambiguous, stop, report the blocker
with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 1. Fully independent of task 01 (`machines-table.tsx`) and task 03
(`backend/internal/assets/assets.go`). Different file, different
ecosystem. Safe to run in parallel with both.

This task is the ONLY editor of `frontend/src/lib/api/types.ts` in this
kanban. Do not allow another task in this kanban to touch it.

## Owner

Next.js dashboard agent (or Go/TS generalist — pure deletion, no
framework knowledge required).

## Files and artifacts

- `frontend/src/lib/api/types.ts` — delete the
  `export interface AlertFilterValues { ... }` block (currently L386–L390
  inclusive) and the `export interface DecisionFilterValues { ... }` block
  (currently L393–L399 inclusive), including the trailing blank line
  between the two blocks and the blank line that follows the second
  block, so the file reads cleanly from the section-separator comment
  block straight into the `function appendQuery(` declaration.

  Target post-edit layout for that region:

  ```ts
  // ---------------------------------------------------------------------------
  // Query parameter builders (architecture §6.1)
  // ---------------------------------------------------------------------------

  function appendQuery(
    params: URLSearchParams,
    ...
  ```

- Do NOT touch any other `frontend/**` file.
- Do NOT touch `backend/**`.
- Do NOT touch `AlertsListRequest`, `DecisionsListRequest`,
  `alertsListParams`, `decisionsListParams`, `AlertItem`, `DecisionItem`,
  or any other declaration in `types.ts`.

## Implementation steps

1. Open `frontend/src/lib/api/types.ts` at the
   `// Query parameter builders (architecture §6.1)` separator comment.
2. Delete the entire `AlertFilterValues` interface block from the
   `export interface AlertFilterValues {` line through its closing `}` and
   the blank line that follows it.
3. Delete the entire `DecisionFilterValues` interface block from the
   `export interface DecisionFilterValues {` line through its closing `}`
   and the blank line that follows it.
4. Leave exactly one blank line between the section-separator comment
   block and the `function appendQuery(` declaration (matching Prettier's
   preference — Prettier tolerates single or double blank lines but the
   surrounding `// ---` separator convention in this file uses a single
   blank line above the next declaration).
5. Run `npx prettier --check` on `types.ts` to confirm the file still
   conforms; if Prettier flags spacing between the separator comment and
   `function appendQuery`, adjust the blank-line count to match Prettier
   (this is formatting, not logic).
6. Run `npm run typecheck` to confirm no downstream module referenced the
   removed interfaces (`grep` already confirmed zero usages, but
   typecheck is the authoritative check — TypeScript does not error on
   removing an unused exported interface).

## Contracts

- The live filter contracts on `AlertsListRequest["filter"]` and
  `DecisionsListRequest["filter"]` are unchanged. Expected shapes
  (already in place from debug-and-fix tasks 02/04):

  ```ts
  // AlertsListRequest["filter"]: { scenario?: string; ip?: string }
  // DecisionsListRequest["filter"]: { ip?: string; type?: string; scenario?: string }
  ```

- No `import` of `AlertFilterValues` / `DecisionFilterValues` continues
  to resolve; the symbols must not exist after this task.

## Acceptance criteria

- `grep -rn "AlertFilterValues\|DecisionFilterValues" frontend/src/`
  returns no matches (exit 1).
- `npx prettier --check "src/lib/api/types.ts"` (run from `frontend/`)
  passes — the file is still Prettier-conformant.
- `npm run typecheck` passes.
- The diff for `types.ts` is pure deletion of the two interface blocks
  (plus, optionally, a single blank-line normalization between the
  separator comment and `function appendQuery(`). No other lines change.

## Verification commands/checks

```bash
cd /root/crowdsec-ui
grep -rn "AlertFilterValues\|DecisionFilterValues" frontend/src/   # must exit 1 (no matches)
git diff -- frontend/src/lib/api/types.ts                          # must show only deletion of the two blocks

cd frontend
npx prettier --check "src/lib/api/types.ts"
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Expected: `grep` returns nothing; all npm scripts pass; the git diff is
pure deletion with no touched surrounding lines.

## Reviewer

Next.js dashboard developer (filter-contract owner would also be
acceptable — the Debug-and-fix task 02 contract owner).

## Out of scope

- Any edit to `AlertsListRequest["filter"]`, `DecisionsListRequest["filter"]`,
  `alertsListParams`, `decisionsListParams`, or the live filter contract.
- Any edit to other interface/type declarations in `types.ts`.
- Touching any other file in `frontend/**` or `backend/**`.
- Renaming the removed interfaces (they are deleted, not renamed).
- Removing any other "unused-looking" export — only the two interfaces
  named in the objective may be removed.

## Coordinator status

- Status: completed
- Completed by: nextjs-dashboard agent (delegated) + coordinator verification
- Completed at: 2026-08-13T14:01:14Z
- Verification: Coordinator re-ran authoritative checks:
  - `grep -rn "AlertFilterValues\|DecisionFilterValues" frontend/src/` → no matches, exit 1.
  - `npx prettier --check "src/lib/api/types.ts"` → exit 0, "All matched files use Prettier code style!".
  - `npm run format:check` → exit 0.
  - `npm run lint` → exit 0.
  - `npm run typecheck` → exit 0.
  - `npm run build` (cold `.next/`) → exit 0.
  - `git diff -- frontend/src/lib/api/types.ts` → pure deletion of the two interface blocks
    (15 deletions, 0 insertions); no surrounding lines touched; exactly one blank
    line between the separator comment and `function appendQuery(`.
  - `AlertsListRequest["filter"]` and `DecisionsListRequest["filter"]` shapes unchanged.
- Commit or artifact reference: working tree (not committed).
