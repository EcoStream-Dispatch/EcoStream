-- =====================================================================
-- EcoStream: ALL database setup in one file, for a NEW Supabase project.
--
-- Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
-- Run it ONCE on an empty project (it creates tables; a second run fails with
-- "already exists", which is harmless but means it was already done).
--
-- This file is just migrations/*.sql joined in order. If you change a migration,
-- rebuild it:  cd supabase && sh make_setup_all.sh
-- =====================================================================



-- ---------------------------------------------------------------------
-- FILE: migrations/20261120000001_init_schema.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- EcoStream Phase 1b - initial schema
-- Source of truth: docs/PROTOTYPE_SPEC.md section 3.
--
-- Units: pressures in kPa GAUGE, temperatures in °C, times in UTC (timestamptz).
--
-- Security model (row-level security is ON for every table):
--   * Owners (logged-in users) can READ their own trucks, tyres, readings and alerts.
--   * Any logged-in user can READ garages.
--   * All WRITES (readings, alerts, acknowledging alerts, devices) go through the
--     FastAPI backend, which uses the service-role key. The service role bypasses RLS.
--   * Nobody but the service role can see `devices` (it holds device key hashes).
-- =====================================================================

-- gen_random_uuid() lives in pgcrypto on older Postgres; built in on 13+.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per fleet owner. id is the same as their Supabase Auth user id.
create table public.fleet_owners (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  phone       text,
  company     text,
  created_at  timestamptz not null default now()
);

create table public.trucks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.fleet_owners (id) on delete cascade,
  reg_no       text not null unique,
  make         text,
  model        text,
  -- '6W' = 2 front + 4 rear (one dual axle); '10W' = 2 front + 8 rear (two dual axles).
  -- Must match frontend/src/lib/tyreLayout.ts.
  axle_config  text not null default '6W' check (axle_config in ('6W', '10W')),
  created_at   timestamptz not null default now()
);

-- The ESP32 (or simulator) fitted to a truck.
create table public.devices (
  id               uuid primary key default gen_random_uuid(),
  truck_id         uuid not null references public.trucks (id) on delete cascade,
  -- sha256 of the device key (spec section 5). NULL = no key issued yet, device cannot send.
  device_key_hash  text unique,
  firmware         text,
  last_seen_at     timestamptz
);

create table public.tyres (
  id                    uuid primary key default gen_random_uuid(),
  truck_id              uuid not null references public.trucks (id) on delete cascade,
  -- e.g. 'FL','FR','RL-O','RL-I','RR-I','RR-O' (10W: 'R1L-O' ... 'R2R-O')
  position              text not null,
  sensor_id             text not null,           -- TPMS sensor ID
  recommended_cold_kpa  numeric not null check (recommended_cold_kpa > 0),
  max_temp_c            numeric not null default 85,
  unique (truck_id, position),
  unique (truck_id, sensor_id)
);

create table public.readings (
  id             bigint generated always as identity primary key,
  tyre_id        uuid not null references public.tyres (id) on delete cascade,
  ts             timestamptz not null,
  pressure_kpa   numeric not null,
  temp_c         numeric not null,
  ambient_c      numeric,
  lat            numeric,
  lon            numeric,
  rssi           int,
  corrected_kpa  numeric not null,  -- pressure at 20 °C, computed by the API on ingest (spec section 4)
  -- Same "impossible value" limits the API checks (spec section 5). Belt and braces.
  constraint readings_pressure_range check (pressure_kpa >= 0 and pressure_kpa <= 1500),
  constraint readings_temp_range     check (temp_c >= -40 and temp_c <= 150)
);

create table public.alerts (
  id               uuid primary key default gen_random_uuid(),
  tyre_id          uuid not null references public.tyres (id) on delete cascade,
  truck_id         uuid not null references public.trucks (id) on delete cascade,
  type             text not null check (type in
                     ('low_pressure', 'critical_pressure', 'slow_leak', 'high_temp', 'sensor_offline')),
  severity         text not null check (severity in ('warning', 'critical')),
  -- Meaning depends on type: kPa (pressure alerts), kPa/hour (slow_leak),
  -- °C (high_temp), minutes (sensor_offline). See frontend/src/lib/status.ts.
  value            numeric,
  message          text,
  created_at       timestamptz not null default now(),
  acknowledged_at  timestamptz
);

create table public.garages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  lat         numeric not null,
  lon         numeric not null,
  phone       text,
  open_24x7   boolean not null default false,
  opens       time,   -- IST
  closes      time,   -- IST (may be earlier than opens = open past midnight)
  services    text[] not null default '{tyre}',
  verified    boolean not null default false
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------

-- Spec: charts and alert logic read "latest readings for a tyre".
create index readings_tyre_ts_idx on public.readings (tyre_id, ts desc);
-- For the 30-day clean-up job.
create index readings_ts_idx on public.readings (ts);

create index trucks_owner_idx   on public.trucks (owner_id);
create index tyres_truck_idx    on public.tyres (truck_id);
create index devices_truck_idx  on public.devices (truck_id);
-- Alerts page (newest first per truck) and de-duplication (same tyre + type in last 30 min).
create index alerts_truck_created_idx on public.alerts (truck_id, created_at desc);
create index alerts_tyre_type_created_idx on public.alerts (tyre_id, type, created_at desc);

-- ---------------------------------------------------------------------
-- Row-level security
-- (select auth.uid()) is wrapped in a sub-select so Postgres evaluates it once
-- per query instead of once per row - Supabase's recommended pattern.
-- ---------------------------------------------------------------------

alter table public.fleet_owners enable row level security;
alter table public.trucks       enable row level security;
alter table public.devices      enable row level security;
alter table public.tyres        enable row level security;
alter table public.readings     enable row level security;
alter table public.alerts       enable row level security;
alter table public.garages      enable row level security;

-- Owners see their own profile.
create policy "owner reads own profile" on public.fleet_owners
  for select to authenticated
  using (id = (select auth.uid()));

-- Owners see their own trucks.
create policy "owner reads own trucks" on public.trucks
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Owners see tyres on their trucks.
create policy "owner reads own tyres" on public.tyres
  for select to authenticated
  using (exists (
    select 1 from public.trucks t
    where t.id = tyres.truck_id and t.owner_id = (select auth.uid())
  ));

-- Owners see readings from tyres on their trucks.
create policy "owner reads own readings" on public.readings
  for select to authenticated
  using (exists (
    select 1 from public.tyres ty
    join public.trucks t on t.id = ty.truck_id
    where ty.id = readings.tyre_id and t.owner_id = (select auth.uid())
  ));

-- Owners see alerts on their trucks.
create policy "owner reads own alerts" on public.alerts
  for select to authenticated
  using (exists (
    select 1 from public.trucks t
    where t.id = alerts.truck_id and t.owner_id = (select auth.uid())
  ));

-- Any logged-in user can read garages.
create policy "logged-in users read garages" on public.garages
  for select to authenticated
  using (true);

-- devices: RLS on and NO policies = only the service role can touch it.
-- No insert/update/delete policies anywhere = only the service role (the API) can write.

-- ---------------------------------------------------------------------
-- Realtime: the dashboard listens for new readings and alerts (spec section 6.5).
-- Supabase Realtime respects the RLS policies above, so owners only get their own rows.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.readings, public.alerts;

-- ---------------------------------------------------------------------
-- FILE: migrations/20261120000002_readings_retention.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Keep 30 days of raw readings (spec section 3).
-- A pg_cron job runs every night at 03:00 UTC (08:30 IST) and deletes older rows.
--
-- pg_cron is available on every Supabase project. If this file errors with
-- "extension pg_cron is not available", enable it first:
--   Dashboard -> Database -> Extensions -> search "pg_cron" -> Enable.
-- =====================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'delete-readings-older-than-30-days',   -- job name (running this again just updates it)
  '0 3 * * *',                             -- every day at 03:00 UTC
  $$ delete from public.readings where ts < now() - interval '30 days' $$
);

-- To check it:   select * from cron.job;
-- To see runs:   select * from cron.job_run_details order by start_time desc limit 10;
-- To remove it:  select cron.unschedule('delete-readings-older-than-30-days');

-- ---------------------------------------------------------------------
-- FILE: migrations/20261120000003_latest_reading_view.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Latest reading per tyre, in one query (used by GET /api/trucks and by
-- /api/ingest to spot offline sensors).
--
-- security_invoker = true means the view runs with the CALLER's permissions,
-- so row-level security still applies: an owner only sees their own tyres.
--
-- The LATERAL ... LIMIT 1 uses the readings (tyre_id, ts desc) index, so it
-- stays fast even with 30 days of readings.
-- =====================================================================

create view public.tyre_latest_reading
with (security_invoker = true) as
select
  t.id as tyre_id,
  t.truck_id,
  r.ts,
  r.pressure_kpa,
  r.corrected_kpa,
  r.temp_c,
  r.lat,
  r.lon
from public.tyres t
cross join lateral (
  select ts, pressure_kpa, corrected_kpa, temp_c, lat, lon
  from public.readings
  where readings.tyre_id = t.id
  order by ts desc
  limit 1
) r;

-- ---------------------------------------------------------------------
-- FILE: migrations/20261121000004_profiles_roles.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Website stage W2: one login, three roles (docs/WEBSITE_SPEC.md section 1, page 5).
--
-- Every login (Supabase Auth user) gets ONE row in public.profiles saying
-- which portal it belongs to: 'owner', 'driver' or 'shipper'.
--
-- Security rules (row-level security is ON):
--   * A logged-in user can READ only their own profile.
--   * A user can UPDATE only their own name and phone. The ROLE column can
--     never be changed by the user (column privileges below), so a driver
--     cannot make themselves an owner.
--   * Nobody but the service role (the API / SQL Editor) can create or delete
--     profiles or change a role. New accounts are set up by EcoStream for now
--     (docs/SUPABASE_SETUP.md), there is no public sign-up.
--
-- Owners keep their row in public.fleet_owners too (trucks point at it).
-- Driver and shipper data tables (trips, shipments) come in stages W4-W6.
-- =====================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'driver', 'shipper')),
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Read own profile only.
create policy "user reads own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Update own profile only ...
create policy "user updates own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ... and only the name and phone columns. Supabase grants everything to
-- `authenticated` by default, so take UPDATE away and give back two columns.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Every existing fleet owner becomes an 'owner' profile.
insert into public.profiles (id, role, full_name, phone)
select id, 'owner', name, phone from public.fleet_owners
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- FILE: migrations/20261121000005_more_axle_layouts.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Website stage W3: more wheel layouts on the Truck page.
-- Adds 12W (twin steer), 14W (three rear dual axles) and 18W (tractor-trailer).
-- Tyre position names for each layout: frontend/src/lib/tyreLayout.ts
-- =====================================================================

alter table public.trucks drop constraint if exists trucks_axle_config_check;
alter table public.trucks
  add constraint trucks_axle_config_check
  check (axle_config in ('6W', '10W', '12W', '14W', '18W'));

-- ---------------------------------------------------------------------
-- FILE: migrations/20261121000006_alert_resolved.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Website stage W4: alert centre tabs Open / Acknowledged / Resolved.
--
--   open          acknowledged_at IS NULL
--   acknowledged  acknowledged_at set, resolved_at IS NULL  (owner has seen it)
--   resolved      resolved_at set                            (problem fixed)
--
-- Resolving also acknowledges (the API sets both), so "open alerts" and the truck
-- status logic don't change. Owners still can't write to `alerts` directly:
-- POST /api/alerts/{id}/resolve does it with the service role, after checking
-- (with row-level security) that the owner can see the alert.
-- =====================================================================

alter table public.alerts add column if not exists resolved_at timestamptz;

-- ---------------------------------------------------------------------
-- FILE: migrations/20261122000007_explicit_grants.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Explicit table permissions (22 Nov 2026).
--
-- New Supabase projects can be created with "Grant API access to new tables
-- automatically" switched OFF. Then the app's roles have no access to our tables
-- at all ("permission denied"), even where row-level security would allow it.
-- These grants make the setup work either way. Row-level security still decides
-- WHICH rows anyone sees:
--   anon (logged out)       select, but no RLS policy lets them see anything
--   authenticated (logged in) select; RLS limits it to their own data
--   service_role (our API)  everything (it bypasses RLS)
-- Writes for logged-in users stay blocked (no insert/update/delete grants),
-- except updating their own name/phone in profiles (granted in migration 4).
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on
  public.fleet_owners, public.trucks, public.devices, public.tyres, public.readings,
  public.alerts, public.garages, public.profiles, public.tyre_latest_reading
to anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
