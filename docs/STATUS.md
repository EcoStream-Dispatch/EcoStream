# Prototype status: acceptance criteria (spec section 1)

Last checked: 20 Nov 2026, end of Stage 6. Written honestly. "Not tested" means not tested.

## Important: no real Supabase project yet
The Supabase project hasn't been created yet (`docs/SUPABASE_SETUP.md`), so **nothing has run
against real Supabase Postgres, Auth or Realtime**. What was tested instead:

| Stand-in | What it proves | What it can't prove |
|---|---|---|
| **PGlite** (real Postgres 16 in memory) running our migrations, seed and `rls_check.sql` | SQL is valid, row-level security rules are right | Supabase's own Auth/Realtime/API layer |
| **pytest** with an in-memory database (61 tests) | Alert logic, ingest, API responses, simulator scenarios | Real Supabase queries in `api/db.py` |
| **Real browser + real frontend + real API** with an in-memory database and a stand-in login endpoint | Login form, token handling, Vite proxy, every page on real API data, acknowledge, logout | Supabase Auth itself, Realtime |

## Results

| # | Criterion | Result | Evidence / what's missing |
|---|---|---|---|
| 1 | Simulator sends readings for 2 trucks × 6 tyres every 10 s; dashboard updates live without refresh | **Partly tested** | Simulator sends 2 × 6 readings per batch to `/api/ingest` over HTTP and they are stored (tested). Dashboard pages show the stored data through the real API (tested in browser). **Live updates (Supabase Realtime) NOT TESTED**: there is no Realtime server without a Supabase project. Code: `frontend/src/services/live.tsx`. |
| 2 | Simulated slow leak (−3 psi/h) raises "slow leak" within 20 minutes | **Pass (automated test)**, not tested live | `test_criterion_2_...` drives the simulator's `--leak TRUCK1:RL-O:3psi_per_hour` through the ingest code with a fake clock: alert at **minute 10**, warning, raised once. With 60 min of normal driving before the leak (`test_required_b_...`): minute 19. Not yet watched in real time against Supabase. |
| 3 | Tyre hot but NOT leaking raises NO alert | **Pass (automated test)**, not tested live | Heating to 80 °C: no alert at all. Cooling after a stop: no alert. `--hot …:95C`: only `high_temp` (it is above the 85 °C limit), never a pressure or leak alert. Our reading of the criterion: "no pressure/leak alert". Please confirm. |
| 4 | Each alert shows the 3 nearest garages open now, with distance | **Pass with stand-in data**, not tested on Supabase | Browser: critical alert showed 3 garages with km, Open 24×7 / open-till, Call button. API test checks 3 results, sorted by distance, closed garages and wrong service filtered out. Distance is straight-line, not road distance. |
| 5 | Owner can log in and sees only their own trucks (RLS tested) | **RLS: Pass (local Postgres). Login: Pass against stand-in. Not tested on Supabase.** | `supabase/tests/rls_check.sql`: 18/18 PASS in PGlite (33/33 after W2) (other owner's trucks, tyres, readings, alerts, latest-reading view all hidden, no direct writes, logged-out visitor sees nothing). Browser: owner pages redirect to login when logged out; wrong password shows an error; login works; logout works even when the network call fails. **Must re-run `rls_check.sql` in the real Supabase SQL Editor.** |
| 6 | Alert logic has unit tests covering cases 2 and 3; all pass | **Pass** | `api/tests/`: 61 passed. Covers 2 and 3 plus 75%-critical, de-duplication, offline sensor, impossible values, API auth. |

## To finish the checks (needs the Supabase project)
1. Do `docs/SUPABASE_SETUP.md` (all 3 migrations, demo user, seed, `rls_check.sql` must show 18 PASS).
2. Create device keys (`simulator/README.md`).
3. Start the API: `cd api && source .venv/bin/activate && uvicorn index:app --reload --port 8000`
4. Start the frontend: `cd frontend && npm run dev`, open http://localhost:5173 and log in as `demo.owner@example.com`.
5. Start the simulator: `python3 simulator/simulate.py --leak TRUCK1:RL-O:3psi_per_hour --hot TRUCK2:FR:95C`
6. Check, and update this file:
   - [ ] **Criterion 1:** the top bar shows a green **Live** dot; "Last seen" and the truck chart update without refreshing.
   - [ ] **Criterion 2:** a slow-leak alert for TN 99 ZZ 0001 RL-O appears within 20 min, without refreshing.
   - [ ] **Criterion 3:** TN 99 ZZ 0002 FR gets only "High temperature", no pressure or leak alert.
   - [ ] **Criterion 4:** the alert shows 3 garages with distance.
   - [ ] **Criterion 5:** create a second user in Supabase with no trucks, log in as them: the fleet page is empty.

## Known gaps and decisions (not failures, but worth knowing)
- **If Realtime drops** (bad network), the top bar shows "Not live" and data stops updating until the page is reloaded. There is no automatic polling fallback.
- **Acknowledging an alert makes the truck show OK** even if the tyre is still leaking (status comes from open alerts). The leak alert will be raised again 30 min later if it continues.
- **Leak detection waits for 10 minutes of data** (not in the spec), to avoid false alarms from sensor noise right after a start. Set `leak_min_span_min = 0` in `api/alert_config.py` to follow the spec exactly.
- **A sensor that never reported** doesn't raise `sensor_offline` (TPMS sensors are heard one at a time, so new installs would false-alarm).
- **10-wheel trucks:** the dashboard supports them (positions `R1L-O` … `R2R-O`), but the seed and simulator use 6 tyres per truck, per the spec.
- **Not done yet:** deployment to Vercel (Stage 7). WhatsApp alerts and Tamil/Hindi are later phases.

## Website build (docs/WEBSITE_SPEC.md)

### W1 public site: done, 21 Nov 2026
| Item | Status |
|---|---|
| Home, Plans & pricing, For garages, About / Contact | **Built.** Screenshots at 360 and 1440 px in `docs/screenshots/w1-*.png`. No horizontal scroll at 360 px on any page (checked with a headless browser). |
| Garage sign-up form, contact / "Book a demo" form | **Mock only.** Nothing is sent or saved; the page says so. Functions `submitGarageSignup` / `submitContact` in `frontend/src/services/api.ts` are ready to point at a real endpoint. |
| English / தமிழ் / हिंदी switch | **Built.** English complete. Tamil and Hindi cover navigation, login, alerts and status words only, and are **machine translations: need a native speaker's review** (TODO in `frontend/src/i18n/strings.ts`). |
| Plan comparison table | Built from `frontend/src/data/plans.ts` (50 parameters from WEBSITE_SPEC). **`docs/PLANS_SPEC.md` is not in the repo yet**, so parameter keys are provisional and the "55 keys" can't be checked. |
| Add-on prices | Not decided, so the site says "price on request". |

### W2 login + roles: done, 21 Nov 2026
| Item | Status |
|---|---|
| Login method | **Email + password** (Supabase Auth). **Phone + OTP is not used**: Supabase needs a paid SMS provider (Twilio etc.) for it. The login page says "coming". |
| One login page with role selector (Owner / Driver / Shipper) | **Built.** Picking the wrong role for an account shows "This is a Driver account…" and logs out again. |
| `profiles` table with `role` | **Built**: `supabase/migrations/20261121000004_profiles_roles.sql`. Users can read their own profile and edit their name/phone, but **cannot change their role**, create or delete profiles. |
| RLS for the new table | `rls_check.sql` now has **33 checks: all PASS in PGlite** (local Postgres), including driver/shipper see no trucks, readings or alerts and can't make themselves owner. Also proven to FAIL when the role protection is removed. **Not yet run on real Supabase.** |
| Route guards | **Built and tested in a browser:** logged out → login page; driver or shipper opening owner pages → sent to their own portal, and the other way round. |
| API | Owner endpoints now also require role `owner` (403 otherwise). 76 API tests pass (61 old + 15 new). |
| Real login path | Tested against a **stand-in** for Supabase Auth (wrong password, wrong role, no role, right role, reload, logout). **Not tested against real Supabase**: the project still isn't set up. |
| Driver and Shipper portals | A welcome page each, listing what's coming in W5 / W6. |
