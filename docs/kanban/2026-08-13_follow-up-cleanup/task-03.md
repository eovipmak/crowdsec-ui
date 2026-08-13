# Task 03 — Relocate `//go:embed all:bundle` directive adjacent to `var bundleFS` in `assets.go`

## Objective

`gofmt -l backend/` flags exactly one file:
`backend/internal/assets/assets.go`. The `//go:embed all:bundle` directive
sits at the TOP of a multi-line explanatory comment block, with a
`//` "link" line below it, immediately above `var bundleFS embed.FS`. Go
requires the `//go:embed` directive to be on the line directly preceding
the `var` it embeds (with no blank line between them), so `gofmt` moves
the directive to the bottom of the comment block. This task relocates the
directive to the correct position manually so the file checks in clean.

Re-verified this session:

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

The desired end state is for the explanatory comment block to remain
intact (unedited prose) and the `//go:embed all:bundle` directive to be
the LAST line of the comment block, immediately above
`var bundleFS embed.FS` with no blank line in between.

## Prerequisites/dependencies

None.

If any prerequisite is missing or ambiguous, stop, report the blocker
with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 1. Fully independent of task 01 (`machines-table.tsx`) and task 02
(`types.ts`). Different file, different ecosystem. Safe to run in
parallel with both.

This task is the ONLY editor of `backend/internal/assets/assets.go` in
this kanban.

## Owner

Go cscli backend agent (or any agent with Go tooling access; the change
is a directive-position move, not a behavioral edit).

## Files and artifacts

- `backend/internal/assets/assets.go` — relocate the
  `//go:embed all:bundle` directive so it directly precedes
  `var bundleFS embed.FS`. Keep the explanatory comment block above the
  directive, unchanged. End-state for the relevant region:

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

- Do NOT touch any other `backend/**` file.
- Do NOT touch `frontend/**`.
- Do NOT regenerate `backend/internal/assets/bundle/` or run
  `backend/build.sh`. The `//go:embed all:bundle` directive is valid
  whether or not the `bundle/` directory currently contains files; the
  build will still succeed.
- Do NOT edit the prose of the explanatory comment block. Only the
  directive position changes.

## Implementation steps

1. Open `backend/internal/assets/assets.go`.
2. Locate the current layout:

   ```go
   //go:embed all:bundle
   //
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
   var bundleFS embed.FS
   ```

3. Move the `//go:embed all:bundle` directive from above the comment
   block to the END of the comment block. Insert a `//` spacer line and
   the `//go:embed all:bundle` directive as the last two lines of the
   comment, immediately followed by `var bundleFS embed.FS` with NO blank
   line between the directive and the `var`.

4. The explanatory comment text (six lines of prose starting with
   `// The "all:" prefix is required because ...`) MUST be byte-for-byte
   unchanged. Only the directive's position and the `//` spacer line
   above it change.

5. Run `gofmt -d backend/internal/assets/assets.go` and confirm it
   produces NO output. If it still flags a difference, the directive is
   not yet adjacent to the `var`; reposition and re-check.

6. Run `go build ./...` from `backend/` to confirm the embed directive
   still compiles (it will — the bundle path is unchanged; only comment
   ordering changed).

## Contracts

- `var bundleFS embed.FS` still embeds the `bundle/` directory. The
  embed target, embed prefix (`all:`), and embed semantics are unchanged.
- `Forward fs.FS = subFS(bundleFS, "bundle")` and the rest of the package
  are unchanged.
- The explanatory comment block still explains why `all:` is required;
  only its position relative to the directive changes.

## Acceptance criteria

- `gofmt -d backend/internal/assets/assets.go` produces no output.
- `gofmt -l backend/` reports zero files (not just `assets.go` — the
  whole `backend/` tree, including `internal/assets/assets.go`).
- `go build ./...` (run from `backend/`) succeeds.
- `go vet ./...` (run from `backend/`) passes.
- `go test ./...` (run from `backend/`) passes — the test for the
  empty-FS fallback (`emptyFS`) is unaffected because the embed target
  is unchanged.
- The explanatory comment prose is byte-for-byte unchanged (verify with
  `git diff` — only directive position and the `//` spacer line above it
  should differ).

## Verification commands/checks

```bash
cd /root/crowdsec-ui
gofmt -d backend/internal/assets/assets.go   # must produce no output
gofmt -l backend/                             # must print nothing
git diff -- backend/internal/assets/assets.go # must show only directive repositioning

cd backend
go vet ./...
go build ./...
go test ./...
```

Expected: `gofmt -d` and `gofmt -l` both clean; build, vet, and tests all
pass; the git diff shows only the directive moving from the top of the
comment block to the bottom (plus a `//` spacer line above the directive
to keep the comment block contiguous).

## Reviewer

Go backend developer.

## Out of scope

- Regenerating the embedded `bundle/` directory or running
  `backend/build.sh`.
- Editing the prose of the explanatory comment block (the six-line
  explanation of why `all:` is required).
- Any change to `subFS`, `emptyFS`, `Forward`, or other declarations in
  the file.
- Any change to other `backend/**` files (including `internal/adapter/`
  and `internal/api/`).
- Any `frontend/**` change.
- Removing the `//` spacer line that gofmt emits above the directive —
  that line is part of the canonical gofmt layout and must stay.

## Coordinator status

- Status: completed
- Completed by: go-cscli-backend agent (delegated) + coordinator verification
- Completed at: 2026-08-13T14:01:14Z
- Verification: Coordinator re-ran authoritative checks:
  - `gofmt -d backend/internal/assets/assets.go` → no output (exit 0).
  - `gofmt -l backend/` → no files printed (exit 0).
  - `go vet ./...` (from `backend/`) → exit 0.
  - `go build ./...` (from `backend/`) → exit 0.
  - `go test ./...` (from `backend/`) → exit 0; adapter/api/auth/config cached-ok,
    assets/logging/cmd have no test files.
  - `git diff -- backend/internal/assets/assets.go` → directive moved from top of
    comment block to bottom (immediately above `var bundleFS embed.FS` with no blank
    line between them), plus a `//` spacer line above the directive. The six-line
    explanatory prose block is byte-for-byte unchanged.
- Commit or artifact reference: working tree (not committed).
