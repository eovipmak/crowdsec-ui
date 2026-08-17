# Task 05 — Frontend page, nav, and routing for Hub

## Objective

Implement the read-only `/hub` SPA page (summary cards for collections/parsers/scenarios/postoverflows counts, tainted/missing/update-available badges, per-type tables with status highlights, `<pre>` JSON fallback for unexpected structures, loading/empty/error states, auto-refresh toggle) and wire it into `App.tsx` / `router.tsx` / `Layout.tsx`.

## Prerequisites/dependencies

- task-04 COMPLETED — requires `frontend/src/hooks/useHub.ts:useHub` and `frontend/src/lib/api/types.ts:HUB_LIST`. If either is missing, STOP, report the blocker, do not guess.
- Existing frontend patterns: `frontend/src/components/Layout.tsx:NAV_ITEMS`, `frontend/src/App.tsx` route tree, `frontend/src/router.tsx`, shadcn/ui components (`src/components/ui/*`), `LoadingSkeleton`, `ErrorPanel`, `CapabilityBadge`, `lucide-react` icons (`Package` or `Boxes`), Tailwind v4 dark theme.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `frontend/src/pages/Hub.tsx` — the Hub page component.
- **MODIFY** `frontend/src/App.tsx` — add `Hub` route (`/hub`).
- **MODIFY** `frontend/src/router.tsx` — update route documentation / table.
- **MODIFY** `frontend/src/components/Layout.tsx` — add "Hub" nav item (icon `Package` or `Boxes` from `lucide-react`, matching existing dark theme).

Do NOT touch `backend/` (tasks 01–03), `frontend/src/hooks/useHub.ts` (task-04), or docs (task-06).

## Concrete implementation steps

1. `frontend/src/pages/Hub.tsx`:
   - State and data:
     - Check capability `capabilities["hub.list"]?.supported`. If unsupported, render degraded state (`CapabilityBadge` showing "unsupported", message explaining cscli/hub unavailable, query disabled).
     - Call `useHub({ enabled: isSupported, refetchInterval: autoRefresh ? 30000 : false })`.
     - State for auto-refresh toggle (off by default) and manual Refresh button.
   - Summary cards section:
     - Render KPI cards for: Collections, Parsers, Scenarios, Postoverflows (or general items count).
     - Highlight warning counters: Tainted items count (amber badge if > 0), Missing items count (red badge if > 0), Update-available count (blue badge if > 0).
   - Per-type inventory tables:
     - Group items by type: `collections`, `parsers`, `scenarios`, `postoverflows`, `contexts`, etc.
     - Collapsible or tabbed / sequential section per type with items count in header.
     - Table columns:
       - `Name` (mono font, primary text)
       - `Version` (showing `version` and if `latest_version` differs, `version → latest_version`)
       - `Status` (Badges: Ok `green`, Update Available `blue`, Tainted `amber`, Missing `red`)
       - `Description` (truncated secondary text)
     - Defensive rendering: if item object structure is non-standard or raw, fallback to `<pre className="mono ...">` JSON block.
   - Standard UI states:
     - Loading: `LoadingSkeleton`.
     - Error: `ErrorPanel` with Retry button surfacing operation error codes without displaying raw stderr.
     - Empty: per-type empty row ("No items installed") and global empty state if all types are empty.
   - Styling: Maintain project design tokens (`bg-[#09090f]`, `border-[#232334]`, `text-zinc-*`, monospace typography for identifiers).
2. `frontend/src/App.tsx`:
   - Import `Hub` from `./pages/Hub`.
   - Add `<Route path="/hub" element={<Hub />} />` inside the `<Route element={<Layout />}>` group.
3. `frontend/src/router.tsx`:
   - Update doc comment / route list to include `/hub`.
4. `frontend/src/components/Layout.tsx`:
   - Import icon `Package` (or `Boxes`) from `lucide-react`.
   - Add `{ to: '/hub', label: 'Hub', icon: Package }` (matching layout item structure) to `NAV_ITEMS`.

## Interfaces/contracts and integration points

- Consumes `useHub()` hook from `frontend/src/hooks/useHub.ts`.
- Checks capability via `capabilities["hub.list"]`.
- Integrates into primary navigation and React Router.

## Acceptance criteria

- `frontend/src/pages/Hub.tsx` exists, exports default `Hub` component.
- Page displays summary cards (counts of collections/parsers/scenarios/postoverflows, tainted/missing/update badges).
- Per-type tables render name, version, status badge, and description with clean dark styling and `<pre>` fallback.
- Auto-refresh toggle defaults off; 30 s polling when enabled; manual refresh button works.
- Degraded mode works when `hub.list` is unsupported.
- Nav item "Hub" appears in primary navigation and active link highlighting functions correctly.
- `App.tsx` routes `/hub` to `Hub` component.
- `npm run typecheck` and `npm run build` pass without errors.

## Verification commands/checks

From `frontend/`:

- `npm run typecheck` → green.
- `npm run build` → green; `dist/index.html` and `dist/assets/*` generated.
- `grep -rn "Hub\|/hub" src/App.tsx src/router.tsx src/components/Layout.tsx src/pages/Hub.tsx` → all references found.
- Walkthrough with dev server:
  ```bash
  npm run dev
  # Visit /hub:
  # - Check summary cards and counts
  # - Check per-type tables (collections, parsers, scenarios, etc.)
  # - Verify status badges (tainted in amber, missing in red, update in blue, ok in green)
  # - Toggle auto-refresh on/off
  # - Verify navigation from /overview, /metrics to /hub and back
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (page consistency, design tokens, error resilience)
- `nextjs-dashboard` secondary for component architecture and React Query integration

## Explicit out-of-scope

- Mutating hub state from UI (no "Update Hub", "Install", "Upgrade" buttons).
- Writing parser or scenario editing UI.
- Modifying backend endpoints (tasks 01–03).
- Adding complex charting or metrics graphing (tables and badges only).

## Coordinator status
- Status: completed
- Completed by: nextjs-dashboard
- Completed at: 2026-08-17T00:00:00Z
- Verification: `npm run typecheck` and `npm run build` passed cleanly; dist artifacts generated without error.
- Commit or artifact reference: working tree
