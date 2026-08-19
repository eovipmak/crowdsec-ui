# Task 04 — Frontend pages: time-range, substring search, and pagination (`Alerts.tsx` / `Decisions.tsx` + `FiltersBar.tsx`)

## Objective

Add time-range (`since`/`until` `datetime-local` → ISO-8601), substring (`scenario_contains`), and `offset` pagination (Prev/Next, `Showing X–Y`, filter-change resets offset) to `frontend/src/pages/Alerts.tsx` and `frontend/src/pages/Decisions.tsx`, wiring to the widened `useAlerts`/`useDecisions` hooks (task-03), while keeping `FiltersBar` generic (use its existing `filters` + `children` slot for pagination and optionally add datetime inputs without breaking other pages).

## Prerequisites/dependencies

- task-03 COMPLETED — requires `useAlerts` / `useDecisions` to accept `since`, `until`, `scenario_contains`, `offset`. If those hook params are missing, STOP and report blocker — do not duplicate hook logic here.
- Existing UI patterns: `frontend/src/components/FiltersBar.tsx` (`filters`, `limit`, `onClear`, `children`), `frontend/src/components/DataTable.tsx`, `frontend/src/components/CapabilityBadge.tsx`, shadcn `Input`/`Button`/`Label`. No new dependency.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer` (includes manual UI verification)

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/pages/Alerts.tsx` — add `since`, `until`, `scenarioContains`, `offset` state; wire to `useAlerts`; add `since`/`until` pickers (native `datetime-local`) + `Scenario contains` input via `FiltersBar`; add pagination bar (Prev/Next + `Showing offset+1–…` + disabled bounds); keep exact `scenario` + `ip` filters; `onClear` resets all + offset.
- **MODIFY** `frontend/src/pages/Decisions.tsx` — mirror for decisions (keep `type` + `ip` alongside `scenario_contains`); same pickers + pagination.
- **MODIFY** `frontend/src/components/FiltersBar.tsx` — only if cleaner: add `since`/`until` as part of the existing `FilterField[]` or extend with an `extraFilters` slot; prefer keeping `FiltersBar` small and using direct `Input` for `datetime-local` inside pages or via `FiltersBar`'s `children` slot so other pages (`Machines`, `Bouncers`, etc.) are not forced to render datetime inputs.
- Do NOT touch `backend/*` (tasks 01–02) or `docs/*` (task-05) beyond what pages import from hooks. Do not add `frontend/package.json` deps.

## Concrete implementation steps

1. `frontend/src/pages/Alerts.tsx`:
   - State: `const [since, setSince] = useState(''); const [until, setUntil] = useState(''); const [scenarioContains, setScenarioContains] = useState(''); const [offset, setOffset] = useState(0);` alongside existing `limit`, `scenario`, `ip`, `inspecting`.
   - Helper `toIsoZ(v: string): string | undefined` — if `v` is `""` → undefined; else `new Date(v).toISOString()` (validates `datetime-local` value; on `Invalid Date` return undefined and rely on backend 400 for bad input — or guard with `isNaN` and pass raw value through). Prefer `v ? new Date(v).toISOString() : undefined`.
   - Hook call:
     ```ts
     const { data, isLoading, error, refetch } = useAlerts({
       limit, scenario: scenario || undefined, ip: ip || undefined,
       since: toIsoZ(since), until: toIsoZ(until),
       scenario_contains: scenarioContains || undefined,
       offset: offset || undefined, // or 0 with default; backend defaults 0 so either is fine — prefer passing offset (0 included) to keep pagination explicit
     });
     ```
   - Reset offset on filter change: for each `setSince`/`setUntil`/`setScenarioContains`/`setScenario`/`setIp`/`setLimit`, also `setOffset(0)` (either inline in `onChange` wrappers or via `useEffect` watching `[since, until, scenarioContains, scenario, ip, limit]`). Changing `offset` itself does not reset.
   - UI — above or inside `FiltersBar`:
     - Keep existing `FiltersBar` `filters={[scenario, ip]}` + `limit` + `onClear` where `onClear` now `setScenario(''); setIp(''); setScenarioContains(''); setSince(''); setUntil(''); setOffset(0);`.
     - Add row (inside `FiltersBar` filters or as separate div directly under it) with:
       - `Scenario contains` text `Input` (placeholder `ssh · http · bf`, mono, same styling as other filters).
       - `Since` `Input type="datetime-local"` + `Until` `type="datetime-local"` (use `Input` from `@/components/ui/input`; set `value={since}` / `value={until}`; wire `onChange={e=>{setSince(e.target.value); setOffset(0);}}` similarly for until and scenarioContains).
     - Pagination bar under table: `div` with Prev/Next `Button` (`variant="outline"` or `"ghost"`, `size="sm"`, `disabled={offset===0}` for Prev; Next disabled when `!data || data.length < limit` i.e. last page). Handlers: `setOffset(o => Math.max(0, o - limit))` and `setOffset(o => o + limit)`. Label: `Showing {offset+1}–{offset+(data?.length ?? 0)}` (or `No results` when empty). Keep mono styling consistent with existing `FiltersBar` count line.
   - Keep `DataTable`, `AlertInspectDialog`, `CapabilityBadge`, `LoadingSkeleton`/`ErrorPanel`/`EmptyState` unchanged.

2. `frontend/src/pages/Decisions.tsx`:
   - Mirror: state `since`/`until`/`scenarioContains`/`offset`; `toIsoZ`; `useDecisions({ limit, type: type||undefined, ip: ip||undefined, since: toIsoZ(since), until: toIsoZ(until), scenario_contains: scenarioContains||undefined, offset })`; offset reset on filter change; same `Scenario contains` + `Since`/`Until` inputs; same pagination bar; `onClear` resets all 5 filters + offset.

3. `frontend/src/components/FiltersBar.tsx`:
   - No required contract change. If datetime inputs are rendered as extra `filters` entries, ensure `FiltersBar` still accepts `type="datetime-local"` via `Input` passthrough (it already renders `Input` per `FilterField`). Otherwise render `Since`/`Until`/`Scenario contains` directly in pages outside `FiltersBar` and keep `FiltersBar` generic — either approach is acceptable; do not force every page to show datetime pickers. Preserve `hasActive` (extend to include new fields if they live inside `filters` prop, else `hasActive` in pages controls Clear disabled state).

4. A11y / styling: keep `Label htmlFor`, `aria-label`, `mono` classes, `min-h-[32px] focus:ring-[#6366f1]` parity with existing `FiltersBar`; pagination buttons have `aria-label` `Previous page` / `Next page`.

## Interfaces/contracts and integration points

- Hooks (task-03): `useAlerts({limit, scenario, ip, since, until, scenario_contains, offset})` → `apiGet('/alerts', …)` → `GET /api/v1/alerts?…` (backend tasks 01–02). Same for `useDecisions`.
- `since`/`until` wire as ISO-8601 `YYYY-MM-DDThh:mm:ss.sssZ` (from `datetime-local` conversion); backend accepts ISO-8601 or `N[smhd]` — ISO path covers picker use; raw `6h` can still be sent if user types duration (optional, not required for picker).
- `scenario_contains` server validates `1..64` chars, no control chars; frontend caps via `maxLength={64}` and trims.
- `offset` `0..10000` int; frontend passes `offset` number; when `offset > 0` backend overfetches `limit+offset` capped 100 then slices — pagination over newest 100 is the contract.
- Cache: TanStack `queryKey: ['alerts', opts]` / `['decisions', opts]` — new fields auto-partition; switching pages or filters triggers fresh fetch.

## Acceptance criteria

- `/alerts` renders `Since` + `Until` (`datetime-local`) and `Scenario contains` inputs alongside existing `Scenario`/`Source IP` + `Limit`; same for `/decisions` (alongside `Type`/`IP`).
- Setting `Since`/`Until`/`Scenario contains` narrows the table (AND with existing exact filters); backend receives correct query (`since`, `until`, `scenario_contains`, `offset`).
- Pagination: Prev disabled at `offset 0`; Next disabled on last page (`data.length < limit`); Prev/Next step by `limit`; `Showing X–Y` label accurate; changing any filter except pagination resets `offset` to 0; `Clear filters` resets all 5 filters + `offset`.
- Existing exact `scenario`/`ip`/`type` still work; `inspect` dialog (alerts) still opens on row click.
- `CapabilityBadge("alerts.list")` / `decisions.list` still shown; `LoadingSkeleton` / `ErrorPanel` / `EmptyState` flows unchanged.
- No new dependency, no backend file touched, `npm run typecheck` + `npm run build` green (verified in task-03 checks and re-verified here).

## Verification commands/checks

From `frontend/`:

- `grep -n "since\|until\|scenario_contains\|offset\|scenarioContains" src/pages/Alerts.tsx src/pages/Decisions.tsx` → new state + hook wiring present.
- `grep -n "datetime-local" src/pages/Alerts.tsx src/pages/Decisions.tsx src/components/FiltersBar.tsx` → pickers present.
- `npm run typecheck` → green (zero errors).
- `npm run build` → green; `dist/index.html` + `dist/assets/*.js` exist.
- Dev proxy walk: `npm run dev` against running uvicorn — visit `/alerts`, set `Since=2026-08-19T00:00`, `Until=2026-08-19T23:59` → table narrows; type `ssh` in `Scenario contains` → substring filter (case-insensitive); Next/Prev paginate distinct slices; combine `since=6h` (if typed) + `scenario_contains=http` + `limit 25` → filtered AND paginated; Clear resets all.

## Reviewer

- `crowdsec-documentation-reviewer` (wire contract confirmation) + manual UI verification.

## Explicit out-of-scope

- Backend `backend/routers/alerts/list.py` / `decisions/list.py` (tasks 01–02).
- `docs/architecture.md` / `docs/operations-reference.md` (task-05).
- New `lib/api/types.ts` constants or `client.ts` changes; new date-picker library; auth/session; DB; Docker; Prometheus text `/metrics`; mutations.

## Coordinator status

- Status: pending
