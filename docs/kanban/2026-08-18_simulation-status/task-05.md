# Task 05 — Frontend banners in Overview + Decisions for simulation

## Objective

Surface simulation state in the UI so operators understand "alerts but no decisions" without SSH. Add an amber banner to `Overview.tsx` when simulation is active (global or per-scenario) and a callout/badge to `Decisions.tsx` when decisions are suppressed. Banner hidden when simulation is OFF; degraded gracefully when capability is unsupported or request fails.

## Prerequisites/dependencies

- task-04 COMPLETED — requires `frontend/src/hooks/useSimulation.ts:useSimulation` and `frontend/src/lib/api/types.ts:SimulationResult` / `SIMULATION_STATUS`. If hook or type is missing, STOP, report blocker.
- `frontend/src/pages/Overview.tsx` and `frontend/src/pages/Decisions.tsx` at post-drilldown state. `frontend/src/components/ui/badge.tsx` and `frontend/src/components/CapabilityBadge.tsx` available.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/pages/Overview.tsx` — import `useSimulation`, render banner above fleet cards; handle loading/error/unsupported gracefully.
- **MODIFY** `frontend/src/pages/Decisions.tsx` — import `useSimulation`, render callout above `FiltersBar`/`DataTable` when simulation is ON.

Do NOT touch `backend/*` (tasks 01–03), `frontend/src/lib/api/types.ts` or `frontend/src/hooks/useSimulation.ts` (task-04), `frontend/src/components/Layout.tsx` (no nav change — simulation is banner-only), or `docs/*` (task-06). Do NOT add a new route or nav item.

## Concrete implementation steps

1. `frontend/src/pages/Overview.tsx`:
   - Add `import { useSimulation } from '@/hooks/useSimulation';` alongside existing `useAlerts`/`useDecisions`/`useMachines`/`useStatusLapi` imports.
   - Inside component, add `const simulation = useSimulation();` alongside existing queries.
   - Derive `const simActive = !!simulation.data && (simulation.data.global || simulation.data.scenarios.length > 0);` and `const simScenarios = simulation.data?.scenarios ?? [];` and `const simGlobal = !!simulation.data?.global;`
   - Render banner BEFORE the main grid, only when `simActive` and not `simulation.isError` with `error.code === 'unsupported'`:
     ```tsx
     {simActive && (
       <div role="status" aria-live="polite" className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3">
         <div className="flex flex-wrap items-center gap-2">
           <Badge variant="signal">Simulation ON</Badge>
           <span className="text-sm text-amber-200">
             {simGlobal ? 'Global simulation is enabled — decisions are suppressed.' : `${simScenarios.length} scenario${simScenarios.length!==1?'s':''} in simulation — decisions suppressed for: ${simScenarios.slice(0,4).join(', ')}${simScenarios.length>4?` +${simScenarios.length-4} more`:''}`}
           </span>
           <Link to="/decisions" className="mono ml-auto text-xs text-amber-300 underline decoration-amber-500/50 underline-offset-4 hover:text-amber-100">View decisions →</Link>
         </div>
         {simScenarios.length > 4 && (
           <div className="mono mt-2 break-words text-xs text-amber-200/70">{simScenarios.join(', ')}</div>
         )}
       </div>
     )}
     ```
   - When `simulation.isError` with `unsupported` or when `simulation.data` is undefined (probe unsupported, cscli missing), render nothing — no false alarm. Do NOT show a "Simulation: off" muted badge when OFF — hide entirely per plan.
   - Optional: add `title="cscli simulation status"` tooltip on the badge.
   - Keep existing loading/error handling: simulation loading does NOT block the page — banner appears independently when data arrives. Do not merge `simulation.isLoading` into `loading` gate.

2. `frontend/src/pages/Decisions.tsx`:
   - Add `import { useSimulation } from '@/hooks/useSimulation';` and `import { Link } from 'react-router-dom';` if not present.
   - Inside component, add `const simulation = useSimulation();` and same `simActive`/`simGlobal`/`simScenarios` derivation.
   - Render callout ABOVE `FiltersBar`:
     ```tsx
     {simActive && (
       <div role="status" aria-live="polite" className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
         <span className="mono text-xs uppercase tracking-widest text-amber-300">Simulation active</span>
         <span className="ml-2 text-sm text-amber-200">Decisions are suppressed{simGlobal ? ' (global)' : ` — ${simScenarios.length} scenario(s) in simulation`}.</span>
         <span className="mono ml-2 break-words text-xs text-amber-200/70">{simScenarios.slice(0,6).join(', ')}</span>
       </div>
     )}
     ```
   - Keep existing `isLoading`/`error` gates for decisions — simulation error does not block decisions table.

3. Styling: use existing dark theme tokens (`#232334` borders, `bg-[#0f0f17]`, amber signal `bg-amber-500`/`text-amber-300`, `Badge variant="signal"`). Do not introduce new Tailwind plugins or global CSS. Match Hub/Metrics banner tone if present.

4. Accessibility: banner has `role="status"` + `aria-live="polite"`; scenario list is readable by screen readers; link has focus ring via existing `focus-visible:ring` pattern.

## Interfaces/contracts and integration points

- Data source: `useSimulation()` → `GET /api/v1/simulation` → `{global, scenarios, raw}`. `global` bool + `scenarios` string[] drive banner visibility.
- No backend change — this task is frontend-only, consuming task-04's hook.
- Existing pages: `Overview.tsx` already renders LAPI/CAPI dots + alert/decision counts; banner is additive above the grid. `Decisions.tsx` already has `FiltersBar` + `DataTable`; callout is additive above filters.
- No new route, no nav item — simulation is not a top-level page per plan A3.

## Acceptance criteria

- `Overview.tsx` shows amber "Simulation ON" banner when `simulation.data.global===true` OR `scenarios.length>0`; banner hidden when simulation is OFF or unsupported/missing; banner contains scenario names (truncated) and a link to `/decisions`.
- `Decisions.tsx` shows "Simulation active — decisions are suppressed" callout when `simActive`; hidden otherwise.
- No banner shown when `simulation.status` is `unsupported` (capability false or cscli missing) — degraded gracefully, no error toast.
- `npm run typecheck` and `npm run build` pass.
- No console errors; banners respect dark theme and are keyboard-accessible.

## Verification commands/checks

From `frontend/`:

- `grep -n "useSimulation" src/pages/Overview.tsx src/pages/Decisions.tsx` → both files import and use the hook.
- `grep -n "Simulation ON\|Simulation active" src/pages/Overview.tsx src/pages/Decisions.tsx` → banner strings present.
- `npm run typecheck` → green.
- `npm run build` → green; `dist/index.html` exists.
- `npm run dev` walk:
  - With `cscli simulation status` showing `global simulation: disabled` → `/overview` has no banner; `/decisions` has no callout.
  - With `cscli simulation enable --global` (or `cscli simulation enable crowdsecurity/ssh-bf`) on host (read-only action for manual test) → `/overview` shows amber banner with scenario list; `/decisions` shows callout. Re-disable after test.
  - With `cscli` missing (rename binary, restart dashboard) → banners hidden, no error panel for simulation.

## Reviewer

- `crowdsec-documentation-reviewer` (banner copy, degraded behavior, no false alarm)
- Secondary: `nextjs-dashboard` for dark-theme fidelity.

## Explicit out-of-scope

- Adding a new `frontend/src/pages/Simulation.tsx` page or `Layout.tsx` nav item — banner-only per plan (defer dedicated page to follow-up if requested).
- Modifying `frontend/src/hooks/useSimulation.ts` or `frontend/src/lib/api/types.ts` (task-04).
- Backend files (`backend/envelope.py`, `backend/capabilities.py`, `backend/routers/simulation/*`, `backend/main.py`) — tasks 01–03.
- Docs (`docs/architecture.md`, `docs/operations-reference.md`) — task-06.
- Mutations (`simulation enable/disable` writes), DB, Docker/K8s, Prometheus.

## Coordinator status
- Status: completed
- Completed by: nextjs-dashboard
- Completed at: 2026-08-18T00:00:00Z
- Verification: grep -n "useSimulation" in Overview.tsx (line 4, line 54) + Decisions.tsx (line 3, line 24); "Simulation ON"/"Simulation active" strings present; npm run typecheck green; npm run build green (dist/index.html produced); Banner renders when simActive, hidden when OFF/unsupported
- Commit or artifact reference: working tree

