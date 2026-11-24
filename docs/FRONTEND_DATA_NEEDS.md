# Frontend data needs (for the backend)

The owner and driver screens now show some things the database and API don't have yet.
In demo mode they use made-up data from `frontend/src/data/mock.ts`. With the real API,
each one is optional in `frontend/src/types.ts`, so the app still works and shows
"No data yet", "Not connected yet" or a sensible default.

This is the list of what the backend would need to add for these screens to show real data.
Nothing here is built on the backend yet. Field names are suggestions: change them if
you like, then tell Rishi so `types.ts` matches.

## New columns on existing tables

| Table | Column | Type | Used by | Without it |
|---|---|---|---|---|
| `fleet_owners` | `gst_no` | text, null | Profile | Shows "Not set" |
| `trucks` | `plan` | text: `lite` / `pro` / `fleet` | Plan badges, Plans page, locked Pro cards | Treated as Lite |
| `trucks` | `goods_type` | text, null | Fleet truck cards | Line hidden |
| `trucks` / `devices` | battery voltage + time (`battery_v` numeric, `battery_ts` timestamptz) | | Truck page battery card | "No data yet" |

`GET /api/trucks` would need to return `plan`, `goods_type`, `battery_v`, `battery_ts` and
`compliance` (below) for each truck.

## New tables

### `drivers`
`id uuid pk, owner_id fk -> fleet_owners, name text, phone text,
availability text ('available' | 'on_duty' | 'off_duty'), truck_id fk -> trucks null,
rating numeric null, created_at`

- RLS: owner reads and updates their own drivers.
- One driver per truck: a unique index on `truck_id` (where not null).
- Endpoints: `GET /api/drivers`, `POST /api/drivers/{id}/assign` with body `{ "truck_id": "uuid" | null }`.
- Used by: Drivers page, Fleet driver strip and truck cards, Driver cockpit card.
- `rating` stays null until the Pro "driver ratings" feature exists.
- Later: a driver login that links to a `drivers` row, so `/driver` shows the driver's own
  truck (today it shows the account's first truck).

### `compliance_items`
`id uuid pk, truck_id fk -> trucks, kind text ('permit' | 'fitness' | 'puc' | 'insurance'),
due_date date, created_at`

- RLS: owner reads their own trucks' items.
- Used by: Reports page, compliance reminders (Overdue / Due soon within 30 days / OK).

### `bookings`
`id uuid pk, alert_id fk -> alerts, truck_id fk, tyre_id fk, garage_id fk -> garages,
status text ('requested' | 'confirmed' | 'done' | 'cancelled'), created_at`

- Endpoints: `POST /api/bookings` with `{ alert_id, garage_id }`, `GET /api/bookings/{id}`.
- Used by: the Book slot button on the alert page, and the Garage booked page.
- Today the frontend says plainly that booking isn't connected. Real booking also needs
  a way to reach the garage (SMS/WhatsApp), which is a later phase.

## Optional, later

| What | Used by | Notes |
|---|---|---|
| `garages.price_note` (text) | Garage list, Garage booked | Until then the app shows "Price: ask garage". Never a made-up number. |
| Owner phone on the driver's side | Driver cockpit "Call owner" | Button shows "(soon)" today. |
| Ghat / no-signal zones along routes | Driver cockpit | Shows "No mapped warnings on this route yet". |
| Engine (CAN/J1939) data | Truck page Pro cards | Pro trucks show "Not connected yet". |
| Single-item endpoints `GET /api/alerts/{id}`, `GET /api/trucks/{id}` | Alert detail, Truck page | Not required: the frontend filters the list endpoints for now. |

## Data points per login (owner / driver / shipper)
The dashboards now list every data point from the "Plans & Parameters" sheet
(`frontend/src/lib/parameters.ts`), filtered by login and by the truck's plan and add-ons.
Tyres, GPS and battery come from today's API. The rest are demo values and need, later:
- `GET /api/trucks` to send `params` (latest value per data-point key, e.g. `coolant_temperature`)
  once the CAN plug-in and add-on sensors exist, and `add_ons` (packs fitted to the truck).
- Shipper accounts and a `shipments` table (Phase 3). `/shipper` is a preview with a demo shipment.
- Which login sees which data point is our reading of the docs (they don't assign them per role).

## Already works with the current backend
- Profile reads `fleet_owners` (`name`, `phone`, `company`) straight from Supabase. RLS already
  lets an owner read only their own row.
- Reports are worked out in the browser from `GET /api/alerts`.
