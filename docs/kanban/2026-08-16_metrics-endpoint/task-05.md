# Task 05 — Frontend page, nav, and routing for metrics

## Objective

Implement the read-only `/metrics` SPA page (component selector over the 14 canonical types + "All", lean tables per component with `<pre>` fallback, loading/empty/error states, optional 30 s poll toggle), and wire it into `App.tsx` / `router.tsx` / `Layout.tsx`.

## Prerequisites/dependencies

- task-04 COMPLETED — requires `frontend/src/hooks/useMetrics.ts:useMetrics` and `frontend/src/lib/api/types.ts:METRICS_SHOW`. If either export is missing or has a different name, STOP, report the blocker, do not infer the API.
- Existing frontend patterns must be available: `frontend/src/components/Layout.tsx:NAV_ITEMS`, `frontend/src/App.tsx` route tree, `frontend/src/router.tsx:routes`, shadcn/ui components (`src/components/ui/*`), `LoadingSkeleton` / `ErrorPanel` / `CapabilityBadge` (or equivalent per current main), `lucide-react`, Tailwind v4 dark theme. If any are absent, STOP, report.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `frontend/src/pages/Metrics.tsx` — the page component.
- **MODIFY** `frontend/src/App.tsx` — add `Metrics` route.
- **MODIFY** `frontend/src/router.tsx` — add `metrics` to route table comment (or structure).
- **MODIFY** `frontend/src/components/Layout.tsx` — add "Metrics" nav item (icon `BarChart3` from `lucide-react`, keeping the existing dark theme and `NAV_ITEMS` shape).

Do NOT touch `backend/` (tasks 01–03), `frontend/src/hooks/useMetrics.ts` / `frontend/src/lib/api/types.ts` contracts (task-04 owns them), or docs (task-06). Do NOT add a new YAML config key.

## Concrete implementation steps

1. `frontend/src/pages/Metrics.tsx`:
   - State: `const [component, setComponent] = useState<string | undefined>(undefined)` where `undefined` means "All" (`GET /metrics`), otherwise one of 14 strings (`GET /metrics/{component}`). Use `useMetrics(component)` for data. Show a selector dropdown containing "All" plus the 14 canonical types in plan §5.2 order: `acquisition`, `alerts`, `appsec-engine`, `appsec-rule`, `bouncers`, `decisions`, `lapi`, `lapi-bouncer`, `lapi-decisions`, `lapi-machine`, `parsers`, `scenarios`, `stash`, `whitelists`.
   - Auto-refresh: a toggle switch (off by default) that when on uses `refetchInterval: 30000` (like `Overview.tsx`'s 30 s poll) — wire via `useMetrics` options or wrap with a container query. Provide manual `Refetch` button unconditionally.
   - Capability badge: read `app.state.capabilities["metrics.show"]` exposure via a lightweight `useCapabilities` hook if present, or the existing `CapabilityBadge` component inside `ErrorPanel` / page chrome. When `metrics.show` is `unsupported`, show a degraded state: badge "unsupported" + explanatory text "Metrics unavailable (cscli missing)" + no fetch (or `enabled: false` on the query) — match the pattern from other degraded pages.
   - Loading state: `LoadingSkeleton` while fetching.
   - Error state: `ErrorPanel` with Retry (re-issues the same GET) that surfaces operation-level error codes (`unsupported`, `timeout`, `unavailable`, `malformed_output`, `crowdsec_failure`, `permission_denied`) and request-level `invalid_parameters`. Never render `stderr`.
   - Empty state: per-section empty row ("No data yet") when a component's object is `{}`; explicit empty-state for "All" with no groups populated.
   - Rendering: lean tables per component with defensive field access (`?.`) — if the payload shape is unexpected, fallback to `<pre className="mono ...">` JSON view. For "All", render collapsed/expandable sections per present type key (or simple sequential sections); each section title is the component key. Payload is `Record<string, unknown>` — heterogeneous per-type, do not strictly type it.
   - Keep the dark theme tokens (`bg-[#09090f]`, `border-[#232334]`, `text-zinc-*`, `mono` class, `focus-visible:ring-[#6366f1]`) and accessibility (Skip-to-content still works on page; selector has `aria-label`).
2. `frontend/src/App.tsx`:
   - `import Metrics from './pages/Metrics'` and add `<Route path="/metrics" element={<Metrics />} />` inside the `<Route element={<Layout />}>` group, alongside `overview/alerts/decisions/machines/bouncers/allowlists`.
3. `frontend/src/router.tsx`:
   - Update the doc comment / route table to mention `metrics` alongside the 6 existing pages.
4. `frontend/src/components/Layout.tsx`:
   - Add `{ to: '/metrics', label: 'Metrics' }` to `NAV_ITEMS` (or a separate metrics nav entry). Use the LOWEST impact insertion — append at end of `NAV_ITEMS` is acceptable. Render uses `NavLink` with the same `cn(...)` active/inactive styling. The icon, if desired, is `BarChart3` from `lucide-react` — import only if existing `lucide-react` usage is present; if not already used, a text-only label is acceptable (do not introduce a new icon library).

## Interfaces/contracts and integration points

- Consumes `useMetrics(component?: string)` → `Record<string, unknown>` result at `operation: "metrics.show"`; relies on `apiGet` envelope unwrapping already provided by `frontend/src/lib/api/client.ts`.
- Error display reuses `frontend/src/lib/api/errors.ts` codes and `ErrorPanel` / `CapabilityBadge` defensive patterns already in the codebase (`Overview.tsx` / other pages).
- Success path for "All" expects keys to be metric types (e.g. `{"acquisition": {...}, "alerts": {...}}`); for filtered it expects `{"<component>": {...}}` single-key object (plan §5.1/§5.5).
- Nav wiring makes `/metrics` reachable via both direct URL and the top nav; React Router fallback (task-08 static SPA `200 index.html` for unknown routes) must keep `/metrics` inside client routing — no backend static shadowing.

## Acceptance criteria

- `frontend/src/pages/Metrics.tsx` exists, exports a default `Metrics` component, and renders: selector (All + 14 types), loading/empty/error states with existing shared components, per-component tables with `<pre>` fallback, and a disabled degraded view when `metrics.show` is unsupported.
- Switching the selector from "All" → `bouncers` refetches `GET /api/v1/metrics/bouncers`; switching back to "All" fetches `GET /api/v1/metrics` (verify via network tab or queryKey).
- Auto-refresh toggle defaults off; when on, polls at 30 s; manual Refresh always available; no console errors; no `stderr` strings rendered.
- `frontend/src/App.tsx` contains a `/metrics` route inside the `Layout` group.
- `frontend/src/components/Layout.tsx` shows "Metrics" in the primary nav, styled consistently with other items.
- `npm run typecheck` and `npm run build` green; visiting `/overview` and other 6 pages still works; unknown route still 200s `index.html` fallback not a metrics shadow.

## Verification commands/checks

From `frontend/`:

- `npm install`
- `npm run typecheck` → green.
- `npm run build` → green; `ls dist/index.html dist/assets/*.js` exists.
- `grep -rn "Metrics\|/metrics" src/App.tsx src/router.tsx src/components/Layout.tsx src/pages/Metrics.tsx` → all four file references present.
- `grep -n "useMetrics\|METRICS_SHOW" src/pages/Metrics.tsx src/hooks/useMetrics.ts` → hook + label wired.
- Dev walkthrough (requires running `uvicorn` + `npm run dev` proxy `/api → 127.0.0.1:8090`):
  ```bash
  npm run dev  # vite dev against running uvicorn (DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090)
  # Visit:
  #   /overview still renders
  #   /metrics renders selector (All + 14 types), shows sections for acquisition/bouncers/etc.
  #   switch selector to "bouncers" → network shows GET /api/v1/metrics/bouncers
  #   switch to "All" → GET /api/v1/metrics with multiple sections / collapsed sections
  #   with cscli missing or capability forced unsupported → CapabilityBadge shows "unsupported" and page disables fetch with explanation
  #   refresh toggle: off by default, on → 30s polling; manual Refresh → single fetch
  #   no console errors, no leaked stderr strings in UI
  #   nav "Metrics" item visible and active style matches other nav items
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (page/route/nav coherence + dark-theme invariants)
- `nextjs-dashboard` secondary for React Query + Tailwind/shadcn patterns

## Explicit out-of-scope

- Modifying any `backend/` file (tasks 01–03 own backend).
- Adding a dedicated API client method — reuse `apiGet`.
- Prometheus text exposition, Grafana dashboards, push/mutation, history/persistence/aggregation, auth/session, DB, Docker/K8s, new config keys, separate databases, or systemd units.
- Alias handling in the selector — only "All" + 14 canonical types.
- Strict TS typing of every metrics payload shape (keep `Record<string, unknown>`).

## Coordinator status
- Status: completed
- Completed by: muse-spark-1.2-contributor
- Completed at: 2026-08-17T09:58:00Z
- Verification summary: task-04 contracts verified (useMetrics + METRICS_SHOW); Metrics.tsx exports default Metrics, selector All+14 in plan §5.2 order, degraded unsupported badge + "Metrics unavailable (cscli missing)" via useCapabilities metrics.show, LoadingSkeleton/ErrorPanel/Retry, per-section lean tables with <pre className="mono"> fallback, empty "No data yet"/"No metrics yet", auto-refresh toggle defaults off with 30s interval effect + manual Refresh, no stderr leak; App.tsx has /metrics inside Layout group; Layout.tsx appends Metrics nav item; router.tsx doc comment updated to mention metrics; npm run typecheck green (tsc --noEmit); npm run build green (vite 6.4.3, 1726 modules, dist/index.html + dist/assets/index-C67YpcyT.js); grep Metrics|/metrics hits all four files; grep useMetrics/METRICS_SHOW wired; queryKey ['metrics', component ?? 'all'] so All -> GET /api/v1/metrics and All->bouncers -> GET /api/v1/metrics/bouncers via useMetrics.
- Commit reference: working tree (frontend/src/pages/Metrics.tsx, frontend/src/App.tsx, frontend/src/router.tsx, frontend/src/components/Layout.tsx)
