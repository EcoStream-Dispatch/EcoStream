# EcoStream

Predictive maintenance for Indian trucks, starting with tyres.
**PREDICT · PROTECT · PERFORM**

Private repo. Read these first:
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

## Secrets
Copy `.env.example` to `.env` and fill it in. `.env` is gitignored. Never commit real keys.
