# Setting up Supabase (database, login, realtime)

About 15 minutes. You need: a browser, and a password manager for the passwords and keys.

Files you will paste from:
- `supabase/migrations/20261120000001_init_schema.sql`: tables, indexes, row-level security, realtime
- `supabase/migrations/20261120000002_readings_retention.sql`: deletes readings older than 30 days
- `supabase/migrations/20261120000003_latest_reading_view.sql`: fast "latest reading per tyre" view
- `supabase/seed.sql`: demo owner, 2 trucks × 6 tyres, 13 fake garages
- `supabase/tests/rls_check.sql`: checks owners only see their own data

> Supabase changes its dashboard now and then. If a menu name below doesn't match exactly, look for the closest one.

## 1. Create the project
1. Go to https://supabase.com and sign up (signing in with GitHub is easiest).
2. Click **New project**.
   - **Name:** `ecostream-proto`
   - **Database password:** click *Generate*, then **save it in your password manager**. You rarely need it, but you can't see it again.
   - **Region:** *South Asia (Mumbai)*, the closest to our trucks.
   - **Plan:** Free.
3. Click **Create new project** and wait 1–2 minutes until it says the project is ready.

## 2. Create the tables
1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261120000001_init_schema.sql`, copy **all** of it, paste, click **Run**.
   You should see *Success. No rows returned*.
3. New query again. Paste all of `supabase/migrations/20261120000002_readings_retention.sql` → **Run**.
   - If it says *extension "pg_cron" is not available*: left menu → **Database** → **Extensions** → search `pg_cron` → enable it → run the file again.
4. New query again. Paste all of `supabase/migrations/20261120000003_latest_reading_view.sql` → **Run**.
5. Check: left menu → **Table Editor**. You should see 7 tables: `alerts`, `devices`, `fleet_owners`, `garages`, `readings`, `trucks`, `tyres`.

## 3. Create the demo owner login
1. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email:** `demo.owner@example.com` (seed.sql looks for exactly this).
   **Password:** make one up, and **save it in your password manager**. You'll use it to log in to the dashboard in Stage 6.
3. Tick **Auto Confirm User** → **Create user**.

Recommended: **Authentication → Sign In / Providers → Email** → turn **off** "Allow new users to sign up".
Then strangers can't create accounts. You add owners by hand (step 3) for now.

## 4. Add the seed data
SQL Editor → New query → paste all of `supabase/seed.sql` → **Run**.
Check in Table Editor: `trucks` has 2 rows, `tyres` 12, `garages` 13.
(Safe to run again: it replaces the old seed rows.)

## 5. Check the security (acceptance criterion 5)
SQL Editor → New query → paste all of `supabase/tests/rls_check.sql` → **Run**.
You get a table of 18 checks. **Every row must say PASS.** It cleans up after itself.
If anything says FAIL, stop and tell Hari/Claude. Don't put real data in yet.

## 6. Check realtime is on
Left menu → **Database** → **Publications** → `supabase_realtime`. `readings` and `alerts` should be switched on.
(The migration does this. This is just a check.)

## 7. Copy the keys into `.env`
There is **one** `.env` file, at the root of the repo. It is gitignored, so it never gets committed.

1. In the repo root, copy the example: `cp .env.example .env`
2. In Supabase: **Project Settings** (gear icon) → **API** (newer dashboards: **API Keys** and **Data API**).
3. Fill in `.env`:

| `.env` line | Where it comes from |
|---|---|
| `SUPABASE_URL` | **Project URL**, looks like `https://abcdxyz.supabase.co` |
| `SUPABASE_ANON_KEY` | **anon / public** key (newer dashboards: *publishable* key, starts `sb_publishable_`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** key (newer: *secret* key, starts `sb_secret_`). Click *Reveal*. |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` |
| `DEVICE_KEY_SALT` | make a random one: run `openssl rand -hex 32` in a terminal and paste the output |
| `VITE_API_BASE` | leave empty for now (Stage 6) |
| `SIM_API_URL`, `SIM_DEVICE_KEY_TRUCK1/2` | see `simulator/README.md` (the key script fills these in) |

### Key safety, please read
- The **anon/publishable** key is meant to be public. It is safe in the frontend because row-level security limits what it can see.
- The **service_role/secret** key **bypasses all security**. It goes ONLY in `.env` (for `/api`) and later in Vercel's settings for the API.
  Never in frontend code, never in chat, never in a screenshot, never committed.
  If it ever leaks: Supabase → Project Settings → API → regenerate it.
- Share keys with Rishi and Hari through your password manager's sharing feature, not WhatsApp or email.

## Testing the SQL without Supabase (for Hari)
`supabase/tests/local_check.cjs` runs the migrations, the seed and the RLS check in a
throwaway in-memory Postgres (PGlite):
```bash
cd supabase/tests
npm install
npm test
```
It ends with `ALL RLS CHECKS PASS`. Run it after any change to the SQL files.
It stubs the Supabase-only parts, so the real check is still step 5.
