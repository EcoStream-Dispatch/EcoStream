# EcoStream status

Last checked: 21 Nov 2026, end of website stage W7. Written honestly:
**built** = the screen exists and works in a browser; **sample data** = it runs on made-up data
because the backend for it doesn't exist yet; **not tested** = not tested.

## Summary (read this first)

### The big picture
- **The whole website is built**: public site, one login with 3 roles, Owner portal (11 sections),
  Driver portal, Shipper portal. Every page was opened at 360 px and 1440 px:
  [all screenshots](screenshots/README.md).
- **Real data only for tyres and alerts.** Tyre readings, tyre status, alerts (open / acknowledged /
  resolved), garages "nearest open" and login roles have a real backend (FastAPI + Supabase).
  **Everything else is sample data**, labelled "Demo data" on the page: engine / brakes / cargo values,
  plans per truck, drivers, shipments and routing, predictions (except tyre ones), maintenance,
  bookings, reports, settings, and the whole driver and shipper portals.
- **No real Supabase project yet**, so nothing has run against real Supabase Postgres, Auth or
  Realtime. Stand-ins used instead are listed below.

### By area
| Area | Built | Data | Tested how | Not tested |
|---|---|---|---|---|
| Public site (Home, Plans, For garages, About/Contact) | Yes | Content from the spec. Forms: **mock, nothing sent** | Browser, 360 + 1440 px | Real form backend (none) |
| Login + roles (owner / driver / shipper) | Yes, email + password | `profiles` table with role, RLS | RLS 34/34 in PGlite; browser against a stand-in for Supabase Auth | Real Supabase Auth; phone OTP (needs a paid SMS provider) |
| Owner: tyres, alerts, garages | Yes | **Real API** (tyre readings, alerts, resolve, nearest garages) | 79 API tests; browser with demo data | Real Supabase; live updates (Realtime) |
| Owner: everything else | Yes | **Sample data** | Browser flows (book garage, create shipment, upgrade plan) | Backend for all of it (not built) |
| Driver portal | Yes | **Sample data** (one demo driver) | Browser flows, SOS hold, Tamil labels | Voice on a real Android phone; real SOS sending; driver-to-truck link in the database |
| Shipper portal | Yes | **Sample data** (one demo shipper) | Browser flows, share-link login | Shipments backend; real invoices |
| Tamil / Hindi | Menus, login, alerts, status words, driver alert sentences | Machine translation | Shown in the browser | **Native-speaker review (TODO)** |

### Tests (all run on 21 Nov 2026)
| Suite | Command | Result |
|---|---|---|
| API (alert logic, ingest, owner API, roles, resolve) | `cd api && .venv/bin/pytest -q` | **79 passed** |
| Database security (RLS) in PGlite | `cd supabase/tests && npm test` | **34/34 PASS** |
| Frontend logic (routes, dispatch, plans, wheel layouts, leak rate, offline) | `cd frontend && npm test` | **14 passed** |
| Every page at 360 + 1440 px (Playwright) | `cd frontend && npm run check-pages` (dev server running) | **96/96 ok**: no sideways scroll, nothing sticking out, no console errors |
| Typecheck + production build | `cd frontend && npm run build` | passes |

### Open items and known risks
- **`docs/PLANS_SPEC.md` is missing.** Plan comparison and locked cards use 50 parameters from
  WEBSITE_SPEC with our own provisional keys, not "the 55 keys".
- **Sample numbers that look real:** ₹ saved (= ₹25,000 per avoided breakdown, an assumption),
  garage ratings and prices, payload limits per wheel layout, add-on prices ("on request"),
  map warnings (ghat / no-signal / bad-road stretches are sample markings), ETA at 45 km/h,
  routes along corridor towns (no road-routing service).
- **Demo changes don't last:** new shipments, bookings, plan changes and settings live only in
  the browser tab.
- **Map tiles:** free OpenStreetMap tiles are fine for a prototype only (OSM usage policy).
- **Dependencies (npm audit, 21 Nov 2026):** upgraded react-router-dom to 6.30.6 and postcss to 8.5.32.
  Left: react-router moderate advisory (fix needs v7; affects links built from user input, which this
  app doesn't have) and Vite / esbuild advisories that affect only the local dev server
  (fix needs a Vite major upgrade). Don't expose `npm run dev` to the internet.
- **Phase 1b acceptance criteria below** still need the real Supabase project to finish.

---

# Phase 1b acceptance criteria (spec section 1)

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

### W3 owner portal part 1: done, 21 Nov 2026
| Item | Status |
|---|---|
| Sidebar layout | **Built.** All 11 sections in the sidebar. Built now: Dashboard, Live Map, Trucks, Truck detail, Alerts. The other 7 show "coming in W4". Top bar: search (truck number / shipment ID), language, notifications bell (open alerts), profile, log out. Phones: bottom tab bar + drawer. |
| Dashboard | **Built.** KPI tiles, map, "Needs attention now", shipments in transit, maintenance in the next 7 days. Truck status counts and alerts come from real tyre data. "Breakdowns avoided" = problems acknowledged this month; "₹ saved" = that × a **sample assumption of ₹25,000 per breakdown** (said on the tile). |
| Live Map | **Built** with Leaflet + OpenStreetMap (no paid key). Filters: status, plan, shipment. Side panel. Layers: garages, no-signal zones, ghats, bad roads; **all layer stretches are sample markings, not surveyed data**. OSM's free tile server is fine for a prototype only (usage policy); real customers need a tile provider. |
| Trucks list | **Built.** Table on desktop, cards on phones, filters, CSV export. |
| Truck detail | **Built**, 9 tabs. **Tyres tab uses real sensor data** (live chart, leak rate worked out from the last 30 min of readings, "unsafe in ~X h"). Engine / Brakes / Power / Driver / Cargo values, predictions (except tyre ones), tread depth, sensor battery, tyre history, maintenance and documents are **sample data** (labelled "Demo data"). Cards not in the truck's plan are locked and link to Plan & Billing. |
| Wheel layouts | 6, 10, 12 (twin steer), 14 and 18 (tractor-trailer). New migration `20261121000005_more_axle_layouts.sql` allows them in the database. The wheel counts on sample trucks 0003-0006 are made up for the demo. |
| Sample fleet | 6 trucks TN 99 ZZ 0001-0006: leak, hot tyre, critical low pressure, offline, all-OK. Only 0001 and 0002 exist in the Supabase seed. |
| Checked | Every owner page at 360 px and 1440 px: no sideways scroll, no console errors. Production build under /EcoStream/ (GitHub Pages): map, deep links, search, locked card → Plan & Billing, Book garage → 3 garages. RLS check still 33/33. |
| Not tested | Live updates on these pages against real Supabase Realtime (same code path as before, still no Supabase project). |

### W4 owner portal part 2: done, 21 Nov 2026
| Item | Status |
|---|---|
| Alert centre | **Built, real data.** Tabs Open / Acknowledged / Resolved. New: alerts can be **resolved** (migration `20261121000006_alert_resolved.sql`, API `POST /api/alerts/{id}/resolve`, 3 new API tests, 1 new RLS check: owners still can't write alerts directly). |
| Alert detail | **Built.** Countdown ("unsafe in ~7 h", from the live leak rate), what to do, 3 nearest open garages (real API), Call, **Book slot → "Garage booked"**, Share with driver (phone share sheet, or copies the text), Acknowledge, Mark resolved. Garage ratings, price ranges and bookings are **sample data**; no garage is really contacted. |
| Predictive Maintenance | **Built.** Fleet-wide ranking, component filter, cost if ignored vs fix now, "this week" plan. Tyre predictions from live alerts, the rest sample. Engine/brake predictions only for trucks whose plan has that data. |
| Shipments + Create shipment | **Built on sample data** (no shipments backend). Suggested truck + driver with reasons (health, size for the weight, cold chain, free at pickup, distance). Payload limits per wheel layout are **sample values, not legal limits**. New shipments last only for the browser tab. |
| Live routing | **Built.** Route = corridor towns (no road-routing service yet), truck's live position, ETA (assumes 45 km/h), km left, stops, warnings ahead (ghat, no signal, bad road), last verified garage before the ghat, timeline (includes real alerts), proof-of-delivery placeholders, share-tracking link (shipper page comes in W6). |
| Drivers, Garages, Reports, Plan & Billing, Settings | **Built on sample data.** Reports: charts + table, "Download PDF" = browser print to PDF. Plan & Billing: changing a plan unlocks/locks that truck's cards (browser tab only); invoices placeholder ("no payments in demo"). Settings: users & roles, alert thresholds, WhatsApp/SMS/email switches, language: **demo only, nothing saved to a server, no messages sent**. |
| Flows checked in a browser | Dashboard → Book garage → alert → slot → "Garage booked" → My bookings. Shipments → Create shipment → live routing. Locked card → Plan & Billing → Upgrade → cards unlocked (21 → 0 locked). Mark resolved → moves to Resolved. No console errors. |
| Layout | Every owner page at 360 px and 1440 px: no sideways scroll, nothing sticking out. |
| Tests | API 79 passed. RLS check 34/34 PASS (PGlite). |

### W5 driver portal: done, 21 Nov 2026
| Item | Status |
|---|---|
| Data | **All sample data** (Murugan K. on TN 99 ZZ 0001, trip SHP-1001). Drivers can't read the owner's trucks (RLS) and there is no driver-to-truck link in the database yet. Needs: a driver_assignments table + a driver API. Labelled "Demo data" on every page. |
| Layout | Mobile first: big text and buttons, bottom tabs (My trip, Truck health, SOS, My trips), alert banner at the top (most dangerous alert first). Tested at 360 px and 1440 px: no sideways scroll, no console errors. |
| My trip | Next town + km, ETA, km left, route map, pick-up and delivery cards with big Call buttons, goods, Start trip / Reached (Reached → "Delivered. Thank you!"). |
| Truck health | Big tyre diagram (tap a tyre: pressure + temperature), Engine / Brakes / Battery tiles ("Not monitored" when the plan doesn't include them). |
| Full-screen alert | One icon, one sentence in Tamil + English (+ Hindi when Hindi is chosen), Play voice (browser text-to-speech: Tamil / Hindi voice if the phone has one, otherwise English with a note), Navigate to garage (opens Google Maps directions to the nearest open sample garage), Call owner (sample number). Dark navy night mode, automatic 7 pm-6 am, with a switch. **Tamil/Hindi sentences are machine translations: need a native speaker's review** (TODO in `frontend/src/i18n/alertSentences.ts`). **Not tested: the actual sound on a real Android phone.** |
| SOS | Press and hold 2 seconds (a short tap does nothing, so no accidental SOS). Uses phone GPS if allowed, else the truck's last position. **Demo: nothing is sent.** "Call 112" (India emergency number) and "Call owner" buttons. |
| My trips | Driving score (0-100) with an 8-week trend, simple tips, past trips. Sample data. |

### W6 shipper portal: done, 21 Nov 2026
| Item | Status |
|---|---|
| Data | **All sample data.** The demo shipper is "Sample Textiles (Chennai)" with 4 shipments (in transit, chilled in transit, scheduled, delivered). Shippers can't read the owner's trucks (RLS) and there is no shipments table yet. Needs: shipments + shipper accounts in the database and a shipper API. Labelled "Demo data". |
| My shipments + Request a shipment | **Built.** Status, ETA, truck condition; requests show "Waiting for transporter". Requests last only for the browser tab. |
| Live tracking | **Built.** Map with the truck and route, ETA, km left, **truck condition in plain words** (Good / Minor issue, being handled / Problem, transporter is on it / No signal), cargo temperature + 24 h trend for cold-chain loads, driver and truck with Call driver, timeline. Shippers do **not** see the owner's technical alerts. |
| Owner's share-tracking link | **Works.** Opening it logged out goes to login with "Shipper" preselected, then straight to the tracking page. |
| Delivery & invoices | **Built.** Proof-of-delivery photo + signature **placeholders**, and a **sample invoice** (clearly marked "not a real bill", no tax lines) that prints / saves as PDF. |
| Checked | All shipper pages at 360 px and 1440 px: no sideways scroll, no console errors. Shippers can't open owner or driver pages. |
