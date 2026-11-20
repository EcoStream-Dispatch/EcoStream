# EcoStream frontend

React + Vite + TypeScript + Tailwind. Owner: Rishi.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Pages
| URL | File | What |
|---|---|---|
| `/` | `pages/LandingPage.tsx` | Public landing page |
| `/login` | `pages/LoginPage.tsx` | Owner login (Supabase email + password) |
| `/fleet` | `pages/FleetPage.tsx` | One card per truck |
| `/trucks/:id` | `pages/TruckPage.tsx` | Tyre layout, per-tyre values, 2-hour chart |
| `/alerts` | `pages/AlertsPage.tsx` | Open/closed alerts, acknowledge, 3 nearest garages |

## Where data comes from
```
page  ->  services/api.ts  ->  FastAPI /api  (with the owner's login token)   when Supabase keys are set
page  ->  services/api.ts  ->  data/mock.ts  ("Demo data", no login)          when they're not
```
- **Pages never import `data/mock.ts`.** They only call `services/api.ts`.
- In `npm run dev`, `/api/*` is proxied to `http://localhost:8000` (see `vite.config.ts`).
- **Login:** `auth/AuthProvider.tsx` (Supabase email + password), `auth/RequireAuth.tsx` guards owner pages.
- **Live updates:** `services/live.tsx` opens one Supabase Realtime connection for new `readings`
  and changed `alerts`. Pages use `useLiveEvents(...)`. The top bar shows Live / Not live.
- `types.ts` mirrors the database tables and API responses (spec sections 3 and 5).

## Units
Stored in kPa (gauge) and °C, times in UTC. Shown as **psi and bar**, °C, and India time (IST).
Helpers: `lib/units.ts`, `lib/format.ts`.

## Other folders
- `components/`: shared UI (layout, status badge, tyre diagram, chart, garage list)
- `lib/`: plain functions, no React (units, distance/opening hours, tyre positions, status colours)
- `hooks/useApi.ts`: loading/error handling for service calls

Environment variables live in the single `.env` at the repo root (see `vite.config.ts` `envDir`).

Brand colours and fonts: see `../docs/BRAND.md`.
