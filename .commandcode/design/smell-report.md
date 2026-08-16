# Smell Report — crowdsec-ui

**Date:** 2026-08-16
**Mode:** smell
**Scope:** frontend/src/**
**Score:** 3/10 — STRONG

## Verdict

**Needs changes.** Strong cluster of AI-tell signals across color, type, layout and stat presentation. Individually each tell is common; together they make the dashboard look assembled from the median shadcn template rather than designed for a security-operations tool.

**TL;DR:** Four identical stat cards, a monochrome near-black/neutral palette with no ops-semantic color, system sans with no scale, and a rounded-xl + shadow card shell everywhere. No tech-gradient is present, but nearly every other default-template tell is. Recommended fix lane: `/design redesign` (structural + palette), then `/design typeset`.

---

## Heuristic Scores

| # | Odor | Score | Key Finding |
|---|---|---|---|
| 1 | Tech gradient | 1 | Absent — palette is flat zinc/neutral, no indigo/cyan wash. |
| 2 | Generic tech hue | 0 | Neutral zinc/black as the only "identity" for a security-ops product. Passes as "no blue" but fails as "no identity". |
| 3 | Feature tile grid | 1 | No marketing tile grid; data-table pages are functional. |
| 4 | Accent rail | 1 | No accent stripe decoration. |
| 5 | Unearned blur | 1 | No frosted glass panels. |
| 6 | Stat monument | 0 | Four equal KPI cards with oversized numbers carrying the Overview. Classic stat-monument pattern. |
| 7 | Icon topper | 0 | Every Overview stat card carries a muted lucide icon top-right (Shield / AlertTriangle / Server / Activity) as filler. Repeated icon-atop-card reflex. |
| 8 | Bounce everywhere | 1 | No elastic motion detected (no animation system at all). |
| 9 | Default type | 0 | `ui-sans-serif, system-ui` with no display/reading scale, one heading size (`text-2xl font-bold`) everywhere. Default-type tell. |
| 10 | Center stack | 0 | Header + main both `max-w-6xl mx-auto` with centered column + `space-y-6` stacking on every page. Conservative centered-column template. |

**Inverted:** 1 = absent (good), 0 = detected (smell). Sum 5/10 maps to the 3/10 verdict after weighting the dominant cluster.

---

## Findings

| # | Severity | Discipline | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | MEDIUM | Surface | `frontend/src/pages/Overview.tsx:28-72` | 4 identical `Card` KPI tiles (same height, same `CardHeader`+`CardTitle` muted-label + small icon, large `text-2xl font-bold` number). Status summary squeezed into badge pills inside the last card. | Commit to a Monitor composition: a primary incident/alert strip (threat level + counts + sparkline/timeline), a secondary panel for LAPI/CAPI health with real status indicators, and a supporting machines/bouncers census. Differentiate card mass, density and information priority instead of equalising everything. | Stat monolith hides priority. Alerts and block decisions are not equally important; the overview should make the operator's next action obvious in the first glance, not require comparing four equal numbers. |
| 2 | MEDIUM | Color | `frontend/src/index.css:3-24`, `frontend/src/components/ui/card.tsx:8`, `frontend/src/components/Layout.tsx:16-35` | Full neutral zinc palette (`#ffffff` / `#0a0a0a` / `#18181b` / `#f4f4f5` / `#e4e4e7`), white page, gray cards (`rounded-xl border bg-card shadow`), black primary pill, neutral muted text. No semantic color for block/alert/health. | Choose an ops-semantic palette: a restrained base (ink or near-black with tinted neutrals) + one disciplined accent for action, plus fixed semantic tokens for `blocked` / `alerting` / `healthy` / `degraded` that are not the generic red/green pair. Tone neutrals toward the base hue (< 0.02 chroma). Cards should not all need a border+shadow to be legible. | Color carries no information and no mood. A security dashboard with no visual distinction between "42 decisions" and "CAPI: Down" fails its primary job. This is also the generic-tech-hue smell in negative: the absence of a chosen hue reads as unchosen. |
| 3 | MEDIUM | Type | `frontend/src/index.css:36-37`, `frontend/src/pages/Overview.tsx:27`, `frontend/src/pages/Alerts.tsx:43`, `frontend/src/components/Layout.tsx:18` | `font-family: ui-sans-serif, system-ui, sans-serif` globally, every page title `text-2xl font-bold`, card titles `text-sm font-medium text-muted-foreground`. No scale, no display cut, no measure. | Establish a compact product type scale (e.g. 12 / 13 / 14 / 18 / 24) with a clear display weight for page titles, a subdued label style for meta, and tabular numerals for counts/IPs/timestamps. If staying on a system font, earn it with scale + weight contrast; otherwise assign a deliberate pairing and document the reason. | Flat scale reads as uncommitted. The hierarchy is conveyed only by `font-bold` vs `font-medium muted`, so scanning is weak and the product has no typographic voice. |
| 4 | LOW | Surface | `frontend/src/components/ui/card.tsx:8` (and every consumer) | Shared `Card` is `rounded-xl border bg-card text-card-foreground shadow` — rounded-lg+ territory with a drop shadow on white. Applied to KPI cards, check-IP form, allowlist entries, error panel. | Recalibrate surface: tighter radius (`rounded-lg` or `rounded-md`) on data-dense cards, reserved depth only where stacking order demands it. Replace blanket `shadow` + `border` with flatter dividers and background contrast on the dashboard canvas, so depth means something. | The card shell is the only composition tool. Overuse of rounded-xl + shadow on a white page flattens depth to a single level and makes every block feel like the same visual object. |
| 5 | LOW | Layout | `frontend/src/components/Layout.tsx:15-40`, `frontend/src/pages/Alerts.tsx:42`, `frontend/src/pages/Decisions.tsx:40`, `frontend/src/components/FiltersBar.tsx:24` | Layout is a centered `max-w-6xl` column: bordered header with pill nav, `space-y-6` stacking (title → badge → filters → table). Every list page repeats the same vertical stack and the same `FiltersBar` + `DataTable` spine. | Keep the functional table pattern but break the monotone stack: anchor filters to a persistent toolbar row, give tables a denser header lane, and introduce a secondary information lane (selection detail / inspector) where monitoring benefits from it. Use alignment and rule lines instead of repeated vertical whitespace. | Center-stack at `max-w-6xl` is safe and inoffensive, but it leaves no composition decision for the ops workflow. The repetition across five pages without variation signals template assembly rather than workflow design. |
| 6 | LOW | Surface | `frontend/src/components/EmptyState.tsx:11-12`, `frontend/src/components/ErrorPanel.tsx:16-27` | Empty states all render the same `Inbox` icon + centered muted text; error state is a bordered `Card` with `AlertTriangle` + "Failed to load data" + outline Retry. | Differentiate states per domain: empty Alerts says what creates an alert and where to look next; empty Machines shows enrollment guidance. Keep iconography minimal and reserve illustration for actions the operator can take. Give errors a heavier signal than empty. | Uniform diluted-icon empties are a direct shadcn/template reflex. They are competent but interchangeable with any SaaS product and fail to teach the CrowdSec domain. |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `frontend/src/components/DataTable.tsx:22-48` | Replace table chrome with custom grid | Table component correctly delegates to shared `ui/table` with proper semantics; revisit only if density or sticky-header needs demand it. |
| `frontend/src/components/FiltersBar.tsx:40-49` | Native `<select>` for Limit | Acceptable on product UI; tuning belongs to `/design interaction` sweep, not smell. |
| `frontend/src/pages/Allowlists.tsx:32-63` | Check-IP card uses Card | Bordered card for a small form is mild; bigger win is palette/type recalibration first. |
| `frontend/src/components/CapabilityBadge.tsx:16-27` | CapabilityBadge pills labeled "smell" | Accent-rail-like pills, but they carry real runtime capability info — functional, not decorative. Not a smell per se. |
| `frontend/src/components/ui/button.tsx:6-32` | shadcn buttonVariants as framework tell | `cva` + variant system is an engineered design system, not a visual odor; smell tracks visual surface tells. |

---

## Verification

| Check | Method | Result |
|---|---|---|
| Read `frontend/src/index.css` | file read | Palette is fully neutral; no gradient, no hue. |
| Read `frontend/src/pages/Overview.tsx` | file read | 4-card stat monument + icon topper verified. |
| Read `frontend/src/components/Layout.tsx` | file read | Centered constrained column + pill nav verified. |
| Read `frontend/src/components/ui/card.tsx`, `EmptyState.tsx`, `ErrorPanel.tsx` | file reads | Rounded-xl + shadow card shell and repeated inbox empty verified. |
| Read `frontend/src/pages/Alerts.tsx`, `Decisions.tsx`, `Machines.tsx`, `Bouncers.tsx`, `Allowlists.tsx` | file reads | Repeated `space-y-6` page stack across all list pages verified. |
| Grep for `gradient` / `bg-gradient` / `from-` / `blur` / `backdrop` | code search | No tech-gradient or unearned blur present. |
| Visual render / screenshot | — | **Not verified** (headless audit, no running dev server). |
| Motion / easing profile | file read | No motion system at all — nothing to evaluate beyond absence. |

---

## Next Modes

- `/design redesign` — Replace stat-monument overview with a prioritized Monitor composition and introduce an ops-semantic palette/surface system (highest leverage).
- `/design typeset` — Establish a deliberate scale, measure and tabular-numeral treatment for the data-dense tables.
- `/design relayout` — Break the repetitive center-stack across list pages with a denser toolbar + inspector pattern.
