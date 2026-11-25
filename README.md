# EcoStream

Predictive maintenance for Indian trucks, starting with tyres.
**PREDICT · PROTECT · PERFORM**

Public repo: never commit secrets (`.env` is gitignored). Read these first:
1. [`CLAUDE.md`](CLAUDE.md): repo rules
2. [`docs/PROTOTYPE_SPEC.md`](docs/PROTOTYPE_SPEC.md): what we are building (source of truth)
3. [`docs/BRAND.md`](docs/BRAND.md): colours, fonts, look

## Folders
| Folder | What | Owner |
|---|---|---|
| `frontend/` | React + Vite + TypeScript + Tailwind dashboard | Rishi |
| `api/` | FastAPI backend (Vercel Python functions) | Hari |
| `supabase/` | Database migrations + seed data | Hari |
| `simulator/` | Python script that pretends to be the ESP32 | Adithya |
| `legacy/` | Old demo, reference only | n/a |

## Run the frontend
Needs Node 18 or newer.
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

## Run everything locally
After `docs/SUPABASE_SETUP.md` and the one-time setup in `api/README.md` and `simulator/README.md`, use three terminals:
```bash
cd api && source .venv/bin/activate && uvicorn index:app --reload --port 8000
```
```bash
cd frontend && npm run dev
```
```bash
python3 simulator/simulate.py
```
Open http://localhost:5173 and log in. Without Supabase keys the frontend runs in **demo mode** on made-up data.

**Online demo (demo data, no login):** https://ecostream-dispatch.github.io/EcoStream/,
published automatically from `main` by `.github/workflows/pages.yml`.

What works, what is sample data and what isn't tested: [`docs/STATUS.md`](docs/STATUS.md).
Screenshots of every page (phone and desktop): [`docs/screenshots/`](docs/screenshots/README.md).

## The website
One login (Owner / Driver / Shipper) and three portals, specified in [`docs/WEBSITE_SPEC.md`](docs/WEBSITE_SPEC.md).
In demo mode (no Supabase keys) you pick a role on the login page, no password needed.

| Address | What |
|---|---|
| `/`, `/plans`, `/garages/join`, `/about` | Public site |
| `/login` | One login with a role selector |
| `/owner/...` | Owner portal: dashboard, live map, trucks, predictive maintenance, alerts, shipments, drivers, garages, reports, plan & billing, settings |
| `/driver/...` | Driver portal (mobile first): my trip, truck health, alert with voice, SOS, my trips |
| `/shipper/...` | Shipper portal: my shipments, tracking, delivery & invoices |

## Tests
```bash
cd api && .venv/bin/pytest -q
```
```bash
cd supabase/tests && npm test
```
```bash
cd frontend && npm test
```
Page check (screenshots of every page at 360 and 1440 px), with `npm run dev` running in another terminal:
```bash
cd frontend && npx playwright install chromium && npm run check-pages
```

## Secrets
Copy `.env.example` to `.env` (repo root) and fill it in. `.env` is gitignored. Never commit real keys.
Supabase setup: [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).
