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
| `/login` | `pages/LoginPage.tsx` | Placeholder until Stage 6 (Supabase login) |
| `/fleet` | `pages/FleetPage.tsx` | One card per truck |
| `/trucks/:id` | `pages/TruckPage.tsx` | Tyre layout, per-tyre values, 2-hour chart |
| `/alerts` | `pages/AlertsPage.tsx` | Open/closed alerts, acknowledge, 3 nearest garages |

## Where data comes from
```
page  ->  services/api.ts  ->  data/mock.ts   (now)
page  ->  services/api.ts  ->  FastAPI /api   (Stage 6)
```
- **Pages never import `data/mock.ts`.** They only call `services/api.ts`.
- Switching to the real backend = changing `services/api.ts` only.
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
