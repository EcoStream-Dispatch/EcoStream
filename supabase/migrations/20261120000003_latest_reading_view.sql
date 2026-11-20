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
