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
