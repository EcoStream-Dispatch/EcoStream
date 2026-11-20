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
