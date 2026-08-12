# CrowdSec Dashboard — Frontend (Next.js + TypeScript + Tailwind)

Internal single-administrator dashboard shell for CrowdSec (kanban task 07).
CrowdSec is the source of truth, accessed exclusively through approved
`cscli` commands behind the Go backend (`/api/v1`). The frontend never
constructs commands, never touches the CrowdSec database, and persists no
CrowdSec data.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS 4 (PostCSS plugin)
- ESLint (`eslint-config-next` + Prettier flat config)
- No runtime data fetching libraries — the typed API client in `src/lib/api`
  wraps `fetch` directly.

## Commands

Run from this directory (`frontend/`):

| Command                | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `npm install`          | Install dependencies                             |
| `npm run dev`          | Start the Next.js dev server (default port 3000) |
| `npm run build`        | Production build (`next build`)                  |
| `npm run start`        | Serve the production build (`next start`)        |
| `npm run lint`         | ESLint (`eslint .`)                              |
| `npm run typecheck`    | TypeScript check (`tsc --noEmit`)                |
| `npm run format`       | Format with Prettier (write)                     |
| `npm run format:check` | Format check (no writes)                         |

## Development proxy

In development, `next.config.ts` rewrites `/api/*` to the Go backend at
`http://127.0.0.1:8090` by default (architecture §9). Override with the
`DASHBOARD_API_TARGET` environment variable (see `.env.example`). The target
is developer configuration — never a browser input.

## Production delivery

`npm run build` produces the static bundle under `.next/`. The native
packaging task (task 11) moves the built assets into `assets/` for embedding
in the Go binary; the Go server serves `/` and `/assets/*` from the bundle and
owns all `/api/*` routing.

## Structure

```
frontend/
  src/
    app/
      layout.tsx            Root layout (metadata, global styles)
      page.tsx              Landing page (sign-in / overview links)
      globals.css           Tailwind CSS v4 baseline
      login/page.tsx        Login route shell (POST /api/v1/session)
      (dashboard)/
        layout.tsx          Protected shell: session + auth guard + nav
        overview/page.tsx   Overview placeholder (task 08)
        alerts/page.tsx     Alerts placeholder (task 09)
        decisions/page.tsx  Decisions placeholder (task 09)
        machines/page.tsx   Machines/status placeholder (task 08)
        scenarios/page.tsx  Scenarios/profiles/collections placeholder (task 10)
        allowlists/page.tsx Allowlists placeholder (task 10)
        bouncers/page.tsx   Bouncers placeholder (task 10)
    components/
      auth/                 SessionProvider, RequireAuth
      layout/               DashboardLayout (sidebar nav + header)
      shared/               PageHeader, states (loading/empty/error/unsupported),
                            OperationStatus, ConfirmationModal, PagePlaceholder,
                            CapabilityBadge
      ui/                   Button, DataTable, Pagination, forms (Field/TextInput)
    lib/
      api/                  types.ts, requests.ts, client.ts, errors.ts,
                            capabilities.ts
      hooks/                use-api-resource.ts, use-mutation.ts
```

## Contract notes

- Routes, shared types, request payloads, and response handling derive from
  `docs/architecture.md` (task 03) and never expose command construction.
- UI states distinguish supported, optional/environment-dependent
  (capability-gated), unsupported, empty, loading, error, and expired-session
  outcomes.
- No functional control exists for matrix rows marked explicitly unsupported
  (component install/remove, profile editing, and the other §5.3 rows).
- Data freshness comes from explicit refresh or bounded polling only; there is
  no streaming, push channel, or local persistence.
