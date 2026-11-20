# Supabase: database, login, realtime. Owner: Hari.

| File | What |
|---|---|
| `migrations/20261120000001_init_schema.sql` | Tables, indexes, row-level security, realtime (spec section 3) |
| `migrations/20261120000002_readings_retention.sql` | Nightly job: delete readings older than 30 days |
| `seed.sql` | Demo owner, 2 trucks × 6 tyres (830 kPa), 13 FAKE garages (spec section 8) |
| `tests/rls_check.sql` | Run in SQL Editor: proves owners only see their own data |
| `tests/local_check.cjs` | Runs all of the above in a local in-memory Postgres (`cd tests && npm install && npm test`) |

Setup steps: [`docs/SUPABASE_SETUP.md`](../docs/SUPABASE_SETUP.md).

Rules: RLS on every table. Only the API (service-role key) writes. New SQL changes go in a NEW
migration file with a later timestamp. Never edit a migration that has already been run.
