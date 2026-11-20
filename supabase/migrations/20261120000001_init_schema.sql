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
