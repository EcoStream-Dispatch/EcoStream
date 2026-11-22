# Setting up Supabase (database, login, realtime)

About 15 minutes. You need: a browser, and a password manager for the passwords and keys.

Files you will paste from:
- `supabase/setup_all.sql`: **all tables, security rules, realtime and clean-up job in one file**
  (it is the 6 files in `supabase/migrations/` joined in order)
- `supabase/seed.sql`: demo owner, 2 trucks × 6 tyres, 13 fake garages (+ demo driver / shipper roles)
- `supabase/tests/rls_check.sql`: checks everyone only sees their own data (34 checks)

> Supabase changes its dashboard now and then. If a menu name below doesn't match exactly, look for the closest one.

## 1. Create the project
1. Go to https://supabase.com and sign up (signing in with GitHub is easiest).
2. Click **New project**.
   - **Name:** `ecostream-proto`
   - **Database password:** click *Generate*, then **save it in your password manager**. You rarely need it, but you can't see it again.
   - **Region:** *South Asia (Mumbai)*, the closest to our trucks.
   - **Plan:** Free.
3. Click **Create new project** and wait 1–2 minutes until it says the project is ready.

## 2. Create the tables (one paste)
1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/setup_all.sql`, copy **all** of it, paste, click **Run**.
   You should see *Success. No rows returned*.
   - If it says *extension "pg_cron" is not available*: left menu → **Database** → **Extensions** →
     search `pg_cron` → enable it → then run the file again in a **new** query.
   - If it says something *already exists*: it was already run once. That's fine; go on.
3. Check: left menu → **Table Editor**. You should see 8 tables: `alerts`, `devices`, `fleet_owners`,
   `garages`, `profiles`, `readings`, `trucks`, `tyres`.

(Developers: the same SQL is split by stage in `supabase/migrations/`. After changing a migration,
run `cd supabase && sh make_setup_all.sh`; `npm test` in `supabase/tests` fails if you forget.)

## 3. Create the demo owner login
1. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email:** `demo.owner@example.com` (seed.sql looks for exactly this).
   **Password:** make one up, and **save it in your password manager**. You'll use it to log in to the dashboard in Stage 6.
3. Tick **Auto Confirm User** → **Create user**.

Optional, to try the other portals: create two more users the same way,
`demo.driver@example.com` and `demo.shipper@example.com`. The seed (step 4) gives them the
Driver and Shipper role. Without them, only the Owner portal can be logged in to.

Recommended: **Authentication → Sign In / Providers → Email** → turn **off** "Allow new users to sign up".
Then strangers can't create accounts. You add users by hand (step 3) for now.

**Roles:** every login needs a row in the `profiles` table with `role` = `owner`, `driver` or `shipper`,
or it can't open any portal. Users can't change their own role. To give a new user a role:
`insert into profiles (id, role, full_name) select id, 'driver', 'Name' from auth.users where email = '...';`

**Why email + password and not phone + OTP:** Supabase can only text OTP codes after an SMS
provider (Twilio, MessageBird, Vonage or Textlocal) is connected under **Authentication → Sign In /
Providers → Phone**. That needs a paid account with the SMS provider. Email + password works on
the free plan, so we use it for the prototype.

## 4. Add the seed data
SQL Editor → New query → paste all of `supabase/seed.sql` → **Run**.
Check in Table Editor: `trucks` has 2 rows, `tyres` 12, `garages` 13, `profiles` 1 (or 3 with the optional driver and shipper).
(Safe to run again: it replaces the old seed rows.)

## 5. Check the security (acceptance criterion 5)
SQL Editor → New query → paste all of `supabase/tests/rls_check.sql` → **Run**.
You get a table of 34 checks (18 from Stage 6, 15 for login roles, 1 for resolving alerts). **Every row must say PASS.** It cleans up after itself.
If anything says FAIL, stop and tell Hari/Claude. Don't put real data in yet.

## 6. Check realtime is on
Left menu → **Database** → **Publications** → `supabase_realtime`. `readings` and `alerts` should be switched on.
(The migration does this. This is just a check.)

## 7. Copy the keys into `.env`
There is **one** `.env` file, at the root of the repo. It is gitignored, so it never gets committed.

**Easiest:** from the repo root run `python3 scripts/set_supabase_env.py`. It asks for the URL and the two keys
(hidden while you paste), checks you didn't swap them, and fills in all 5 Supabase lines. Or by hand:

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
