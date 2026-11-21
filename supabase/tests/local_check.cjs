// Local database check - no Supabase account needed.
// Runs the migrations, seed.sql and tests/rls_check.sql inside PGlite
// (real Postgres compiled to WebAssembly) with small stand-ins for the
// Supabase-only parts (auth.users, auth.uid(), roles, pg_cron, Realtime).
//
//   cd supabase/tests && npm install && npm test
//
// It is a quick safety net for changes to the SQL. The real check is still
// running rls_check.sql in the Supabase SQL Editor (docs/SUPABASE_SETUP.md).
const { PGlite } = require('@electric-sql/pglite')
const fs = require('fs')
const dir = require("path").join(__dirname, "..")
const read = (p) => fs.readFileSync(dir + '/' + p, 'utf8')
;(async () => {
  const db = new PGlite()
  // --- Supabase stubs ---
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text unique, aud text, role text);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    create publication supabase_realtime;
    create schema cron;
    create table cron.job (jobname text primary key, schedule text, command text);
    create function cron.schedule(n text, s text, c text) returns int language sql as
      $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = s, command = c returning 1 $$;
  `)
  const mig = fs.readdirSync(dir + '/migrations').filter((f) => f.endsWith('.sql')).sort()
  for (const f of mig) {
    let sql = read('migrations/' + f).replace(/create extension if not exists (pg_cron|pgcrypto);/g, '-- (stubbed) $&')
    await db.exec(sql)
    console.log('migration ok:', f)
  }
  // Seed should fail clearly before the user exists
  try { await db.exec(read('seed.sql')); console.log('UNEXPECTED: seed ran without user') }
  catch (e) { console.log('seed without user -> error (expected):', e.message) }
  await db.exec(`insert into auth.users (id, email, aud, role) values (gen_random_uuid(), 'demo.owner@example.com', 'authenticated', 'authenticated')`)
  await db.exec(read('seed.sql'))
  await db.exec(read('seed.sql')) // run twice: must be re-runnable
  const counts = await db.query(`select (select count(*) from trucks) trucks, (select count(*) from tyres) tyres,
    (select count(*) from devices) devices, (select count(*) from garages) garages, (select count(*) from fleet_owners) owners, (select count(*) from profiles) profiles`)
  console.log('after seeding twice:', counts.rows[0])
  // Impossible-value check constraints
  try { await db.exec(`insert into readings (tyre_id, ts, pressure_kpa, temp_c, corrected_kpa) select id, now(), 1600, 30, 1 from tyres limit 1`); console.log('UNEXPECTED: 1600 kPa accepted') }
  catch (e) { console.log('1600 kPa rejected (expected):', e.message) }
  // Retention job command works
  await db.exec(`insert into readings (tyre_id, ts, pressure_kpa, temp_c, corrected_kpa) select id, now() - interval '31 days', 830, 30, 801 from tyres limit 2;
                 insert into readings (tyre_id, ts, pressure_kpa, temp_c, corrected_kpa) select id, now(), 830, 30, 801 from tyres limit 1;`)
  const job = (await db.query(`select command from cron.job`)).rows[0]
  await db.exec(job.command)
  console.log('readings left after retention job (expect 1):', (await db.query('select count(*) from readings')).rows[0].count)
  await db.exec('delete from readings')
  // RLS check
  const res = await db.exec(read('tests/rls_check.sql'))
  const rows = res[res.length - 1].rows
  console.table(rows)
  console.log('test data left behind (expect 2 trucks, 1 owner, 1 profile, 1 user):',
    (await db.query(`select (select count(*) from trucks) t, (select count(*) from fleet_owners) o, (select count(*) from profiles) p, (select count(*) from auth.users) u`)).rows[0])
  const ok = rows.every((r) => r.result === 'PASS')
  console.log(ok ? 'ALL RLS CHECKS PASS' : 'SOME RLS CHECKS FAILED')
  if (!ok) process.exit(1)
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
