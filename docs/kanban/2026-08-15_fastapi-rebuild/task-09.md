# Task 09 — Frontend scaffold: Vite 6 + React 19 + TS + Tailwind v4 + shadcn/ui

## Objective

Scaffold the new Vite + React 19 + TypeScript SPA in `/root/crowdsec-ui/frontend/` per plan §7. Include: strict TS config, Tailwind v4 CSS-first, in-repo shadcn/ui primitives (button/card/dialog/...), React Router 7, TanStack Query v5, native fetch API client implementing the minimal-envelope parser (plan §3.1). Build + typecheck MUST be green. NO Next.js, NO axios, NO login/auth/mutation artifacts.

## Prerequisites/dependencies

- task-01 COMPLETED — envelope contract (the 8 error codes + envelope JSON shapes) is the single source for the API client's parsing logic.
- Backend tasks (02–08) NOT required to start; the API client knows the envelope shapes abstractly.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard` (NOTE: the agent's name hails from the legacy Next.js dashboard; plan §7 mandates the NEW stack — Vite 6/React 19/Tailwind v4 CSS-first/shadcn/ui in-repo/React Router 7/TanStack Query v5/native fetch. DO NOT use Next.js.)
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/postcss.config.js` (if Tailwind v4 needs one — verify against v4 docs; the `@tailwindcss/vite` plugin is preferred).
- **CREATE** `frontend/components.json` (shadcn config pointing to `src/components/ui`).
- **CREATE** `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/router.tsx`, `frontend/src/index.css`.
- **CREATE** shadcn/ui primitives in-repo under `frontend/src/components/ui/` (button, card, dialog, input, table, badge, skeleton, sonner) — copy the official generated sources for shadcn/ui; each is self-contained (imports only Radix + clsx + tailwind-merge). DO NOT depend on `npx shadcn add` at build time.
- **CREATE** `frontend/src/lib/api/` — `client.ts`, `types.ts`, `errors.ts`.
- **CREATE** `frontend/src/lib/utils.ts` — `cn(...)` helper (clsx + tailwind-merge) consumed by shadcn primitives.
- **CREATE** `frontend/src/components/` — placeholders for shared components used by task-10 (actual implementation deferred to task-10): `Layout.tsx`, `DataTable.tsx`, `FiltersBar.tsx`, `ErrorPanel.tsx`, `EmptyState.tsx`, `CapabilityBadge.tsx`, `LoadingSkeleton.tsx`. (Skeletons only — task-10 fills page logic.)
- **CREATE** `frontend/.gitignore` — `node_modules/`, `dist/`.

Do NOT touch any file under `backend/`.

## Concrete implementation steps

1. `frontend/package.json`:
   ```json
   {
     "name": "crowdsec-dashboard-frontend",
     "private": true,
     "version": "1.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "tsc -b && vite build",
       "typecheck": "tsc --noEmit",
       "preview": "vite preview"
     },
     "dependencies": {
       "react": "^19",
       "react-dom": "^19",
       "react-router-dom": "^7",
       "@tanstack/react-query": "^5",
       "@radix-ui/react-dialog": "^1",
       "@radix-ui/react-dropdown-menu": "^2",
       "@radix-ui/react-label": "^2",
       "@radix-ui/react-slot": "^1",
       "@radix-ui/react-tabs": "^1",
       "clsx": "^2",
       "tailwind-merge": "^2",
       "lucide-react": "^0.460.0",
       "sonner": "^1"
     },
     "devDependencies": {
       "@tailwindcss/vite": "^4",
       "@types/react": "^19",
       "@types/react-dom": "^19",
       "@vitejs/plugin-react": "^4",
       "tailwindcss": "^4",
       "typescript": "^5",
       "vite": "^6"
     }
   }
   ```
   (Pin only major versions; lockfile resolves exact.)
2. `frontend/tsconfig.json` STRICT:
   - `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`.
   - `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `jsx: react-jsx`.
   - Path alias `"@/*": ["./src/*"]`.
3. `frontend/vite.config.ts`:
   ```ts
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import tailwind from '@tailwindcss/vite';
   import { fileURLToPath, URL } from 'node:url';

   export default defineConfig({
     plugins: [react(), tailwind()],
     resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
     server: {
       proxy: {
         '/api': {
           target: process.env.DASHBOARD_API_TARGET ?? 'http://127.0.0.1:8090',
           changeOrigin: true,
         },
       },
     },
     build: { outDir: 'dist', sourcemap: false },
   });
   ```
4. `frontend/src/index.css`: Tailwind v4 CSS-first:
   ```css
   @import "tailwindcss";

   @theme {
     --color-background: #ffffff;
     --color-foreground: #0a0a0a;
     --color-card: #ffffff;
     --color-card-foreground: #0a0a0a;
     --color-primary: #18181b;
     --color-primary-foreground: #fafafa;
     --color-muted: #f4f4f5;
     --color-muted-foreground: #71717a;
     --color-border: #e4e4e7;
     --color-input: #e4e4e7;
     --color-ring: #d4d4d8;
     --radius: 0.5rem;
   }

   html, body, #root { height: 100%; margin: 0; }
   body { background: var(--color-background); color: var(--color-foreground);
          font-family: ui-sans-serif, system-ui, sans-serif; }
   ```
5. shadcn/ui primitives — copy the official generated `.tsx` for `button`, `card`, `dialog`, `input`, `label`, `table`, `badge`, `skeleton`, `sonner` into `frontend/src/components/ui/`. Each is self-contained (imports Radix + `clsx`/`tailwind-merge` from `@/lib/utils`). DO NOT add a `shadcn` package dep; they are vendored sources.
6. `frontend/src/lib/utils.ts`:
   ```ts
   import { clsx, type ClassValue } from 'clsx';
   import { twMerge } from 'tailwind-merge';
   export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
   ```
7. `frontend/src/lib/api/types.ts` — mirror `backend/envelope.py` + `backend/errors.py` exactly:
   ```ts
   export type SuccessEnvelope<T> = { operation: string; result: T };
   export type OperationErrorEnvelope = { operation: string; error: { code: string; message: string } };
   export type RequestErrorEnvelope = { error: { code: string; message: string } };

   export const INVALID_PARAMETERS = 'invalid_parameters';
   export const NOT_FOUND = 'not_found';
   export const METHOD_NOT_ALLOWED = 'method_not_allowed';
   export const INTERNAL = 'internal';
   export const CROWDSEC_FAILURE = 'crowdsec_failure';
   export const TIMEOUT = 'timeout';
   export const UNAVAILABLE = 'unavailable';
   export const PERMISSION_DENIED = 'permission_denied';
   export const MALFORMED_OUTPUT = 'malformed_output';
   export const UNSUPPORTED = 'unsupported';
   ```
8. `frontend/src/lib/api/errors.ts`:
   ```ts
   import { type Class } from 'type-fest'; // optional — or inline
   const FALLBACKS: Record<string, string> = {
     invalid_parameters: 'The request parameters are invalid.',
     not_found: 'The requested resource was not found.',
     method_not_allowed: 'This request method is not allowed.',
     internal: 'An unexpected server error occurred.',
     crowdsec_failure: 'The CrowdSec command failed.',
     timeout: 'The CrowdSec command timed out.',
     unavailable: 'The CrowdSec command is not available.',
     permission_denied: 'CrowdSec denied permission to run the command.',
     malformed_output: 'CrowdSec returned malformed output.',
     unsupported: 'This operation is not supported.',
   };
   export function messageFor(code: string): string {
     return FALLBACKS[code] ?? 'An unexpected error occurred.';
   }
   ```
   (Drop the `type-fest` dep; inline the `Record<string,string>` type — added in step-1 dep cleanup if `type-fest` was listed.)
9. `frontend/src/lib/api/client.ts`:
   ```ts
   const API_BASE = '/api/v1'; // appended to all paths; dev proxy forwards
   export class ApiError extends Error {
     constructor(public code: string, public operation: string | null, message: string) {
       super(message);
       this.name = 'ApiError';
     }
   }
   export async function apiGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
     const url = new URL(API_BASE + path, window.location.origin);
     if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
     const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' });
     let body: any = null;
     try { body = await resp.json(); } catch {}
     if (resp.ok && body && body.operation && body.result !== undefined) {
       return body.result as T;
     }
     if (resp.ok && body && body.operation && body.error) {
       throw new ApiError(body.error.code, body.operation, body.error.message);
     }
     // request-level error (4xx/5xx) — body shape is {error: {code, message}}
     const code = body?.error?.code ?? 'internal';
     const message = body?.error?.message ?? 'An unexpected server error occurred.';
     throw new ApiError(code, null, message);
   }
   ```
10. `frontend/src/main.tsx` — bootstrap React with `BrowserRouter`, `QueryClientProvider`, `Toaster` (sonner), the `App` router:
    ```tsx
    import { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import { BrowserRouter } from 'react-router-dom';
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import { Toaster } from 'sonner';
    import App from './App';
    import './index.css';

    const queryClient = new QueryClient({ defaultOptions: { queries: { refetchInterval: 30000, retry: 1, staleTime: 30_000 } } });
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <App />
            <Toaster position="bottom-right" />
          </QueryClientProvider>
        </BrowserRouter>
      </StrictMode>,
    );
    ```
11. `frontend/src/App.tsx` — placeholder router wiring (actual page components land in task-10; this task exposes the layout + route table):
    ```tsx
    import { Routes, Route, Navigate } from 'react-router-dom';
    import Layout from './components/Layout';
    export default function App() {
      return (
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            {/* task-10 adds: /overview /alerts /decisions /machines /bouncers /allowlists */}
            <Route path="*" element={<div className="p-8">Page not found</div>} />
          </Route>
        </Routes>
      );
    }
    ```
12. `frontend/src/components/Layout.tsx`: minimal — top nav with React Router `NavLink`s (Overview/Alerts/Decisions/Machines/Bouncers/Allowlists) + `<Outlet />`. NO login state (plan D5 — auth dropped).
13. `frontend/src/components/{DataTable,FiltersBar,ErrorPanel,EmptyState,CapabilityBadge,LoadingSkeleton}.tsx`: skeleton stubs (types + minimal JSX) for task-10 to flesh out. Each must export a typed component.

## Interfaces/contracts and integration points

- `apiGet<T>(path, params?)` is consumed by every TanStack `useQuery` hook in task-10.
- `ApiError.code` `'unsupported'` ⇒ task-10's `CapabilityBadge` shows the section disabled.
- `vite.config.ts` dev proxy: `/api` → `http://127.0.0.1:8090` (env override `DASHBOARD_API_TARGET`).
- `dist/` build output is what task-08's static handler serves.
- The `index.html` at `frontend/index.html` mounts `#root` from `frontend/src/main.tsx`.

## Acceptance criteria

- `npm install` succeeds (no peer-dep conflicts at the pinned majors).
- `npm run typecheck` (=> `tsc --noEmit`) green.
- `npm run build` green; `dist/index.html` + `dist/assets/*.js` exist.
- `grep -rn 'next/' frontend/src/` → no matches (no Next.js imports).
- `grep -rn 'from "axios"' frontend/src/` → no matches.
- shadcn primitives present under `frontend/src/components/ui/` as `.tsx` files (NOT pulled from `node_modules/shadcn`).
- `grep -rn 'useMutation' frontend/src/` → no matches (no mutation hooks; plan D6).
- `grep -rn 'X-CSRF-Token' frontend/src/` → no matches (no CSRF; plan D5).
- `grep -nE '@import "tailwindcss"' frontend/src/index.css` → present (Tailwind v4 CSS-first confirmed).

## Verification commands/checks

From `frontend/`:
- `npm install` → green.
- `npm run typecheck` → green.
- `npm run build` → green; `ls dist/` shows `index.html` + `assets/`.
- `grep -rn 'next/\|"axios"\|useMutation\|X-CSRF-Token' src/` → no matches.
- `grep -nE '@import "tailwindcss"' src/index.css` → matches.
- Optional dev check (when backend up): `npm run dev` then open `http://localhost:5173/overview` — should hit `/overview` placeholder with no console errors (data fetch will fail with no backend; acceptable).

## Explicit out-of-scope

- Backend (tasks 02–08).
- The 6 page implementations (task-10).
- Deploy/docs (task-11).
- Tests / vitest / playwright (D12).
- Theme toggle (dark mode) — optional in shadcn; skip.
- Editing the source plan.

## Coordinator status
- Status: pending
- Completed by: —
- Completed at: —
- Verification: —
- Commit or artifact reference: —
