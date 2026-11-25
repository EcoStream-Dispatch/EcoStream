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
