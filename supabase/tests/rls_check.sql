-- =====================================================================
-- Row-level security check (spec acceptance criterion 5:
-- "Owner can log in and sees only their own trucks").
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
-- Run it AFTER the migrations and seed.sql.
--
-- What it does:
--   1. Adds a temporary second owner ("owner B") with one truck, tyre, reading and alert,
--      plus one reading and alert for the demo owner ("owner A").
--   2. Pretends to be owner A, then owner B, then a logged-out visitor, and counts
--      what each one can see or change.
--   3. Throws all the test data away again (nothing is saved).
--
-- Every row in the result should say PASS.
-- =====================================================================

create or replace function pg_temp.rls_check()
returns table (check_name text, expected bigint, actual bigint, result text)
language plpgsql as $$
declare
  a        uuid;                          -- demo owner (from seed.sql)
  b        uuid := gen_random_uuid();     -- temporary owner B
  b_truck  uuid := gen_random_uuid();
  b_tyre   uuid := gen_random_uuid();
  a_tyre   uuid;
  a_alert  uuid;
  a_trucks bigint;
  names    text[]   := '{}';
  exps     bigint[] := '{}';
  acts     bigint[] := '{}';
  n        bigint;
begin
  select id into a from auth.users where email = 'demo.owner@example.com';
  if a is null then
    raise exception 'demo.owner@example.com not found - run seed.sql first';
  end if;

  -- Everything in this inner block is rolled back at the end (see the exception handler).
  begin
    -- ----- Test data (as the admin, RLS does not apply) -----
    insert into auth.users (id, email, aud, role)
      values (b, 'rls-test-' || b || '@example.com', 'authenticated', 'authenticated');
    insert into public.fleet_owners (id, name) values (b, 'RLS test owner B');
    insert into public.trucks (id, owner_id, reg_no, axle_config)
      values (b_truck, b, 'RLS-TEST-' || left(b::text, 8), '6W');
    insert into public.tyres (id, truck_id, position, sensor_id, recommended_cold_kpa)
      values (b_tyre, b_truck, 'FL', 'RLSTEST', 830);
    insert into public.readings (tyre_id, ts, pressure_kpa, temp_c, corrected_kpa)
      values (b_tyre, now(), 830, 30, 801);
    insert into public.alerts (tyre_id, truck_id, type, severity, value, message)
      values (b_tyre, b_truck, 'low_pressure', 'warning', 700, 'RLS test');

    select ty.id into a_tyre from public.tyres ty join public.trucks t on t.id = ty.truck_id
      where t.owner_id = a limit 1;
    insert into public.readings (tyre_id, ts, pressure_kpa, temp_c, corrected_kpa)
      values (a_tyre, now(), 830, 30, 801);
    insert into public.alerts (tyre_id, truck_id, type, severity, value, message)
      select a_tyre, ty.truck_id, 'low_pressure', 'warning', 700, 'RLS test'
      from public.tyres ty where ty.id = a_tyre
      returning id into a_alert;

    select count(*) into a_trucks from public.trucks where owner_id = a;

    -- ----- Act as owner A -----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

    select count(*) into n from public.trucks;
    names := array_append(names, 'A sees exactly their own trucks'); exps := exps || a_trucks; acts := acts || n;
    select count(*) into n from public.trucks where id = b_truck;
    names := array_append(names, 'A cannot see B''s truck'); exps := exps || 0::bigint; acts := acts || n;
    select count(*) into n from public.tyres where id = b_tyre;
    names := array_append(names, 'A cannot see B''s tyre'); exps := exps || 0::bigint; acts := acts || n;
    select count(*) into n from public.readings where tyre_id = b_tyre;
    names := array_append(names, 'A cannot see B''s readings'); exps := exps || 0::bigint; acts := acts || n;
    select count(*) into n from public.alerts where truck_id = b_truck;
    names := array_append(names, 'A cannot see B''s alerts'); exps := exps || 0::bigint; acts := acts || n;
    select count(*) into n from public.readings where tyre_id = a_tyre;
    names := array_append(names, 'A can see own readings (at least 1)'); exps := exps || 1::bigint; acts := acts || least(n, 1);
    select count(*) into n from public.alerts where id = a_alert;
    names := array_append(names, 'A can see own alert'); exps := exps || 1::bigint; acts := acts || n;
    select count(*) into n from public.devices;
    names := array_append(names, 'A cannot see devices (key hashes)'); exps := exps || 0::bigint; acts := acts || n;
    select count(*) into n from public.garages;
    names := array_append(names, 'A can see garages (at least 1)'); exps := exps || 1::bigint; acts := acts || least(n, 1);
    select count(*) into n from public.fleet_owners;
    names := array_append(names, 'A sees only own owner profile'); exps := exps || 1::bigint; acts := acts || n;

    -- Writes must be blocked (only the API, with the service role, may write).
    begin
      insert into public.readings (tyre_id, ts, pressure_kpa, temp_c, corrected_kpa)
        values (a_tyre, now(), 830, 30, 801);
      n := 1;  -- insert worked = bad
    exception when insufficient_privilege then
      n := 0;  -- blocked = good
    end;
    names := array_append(names, 'A cannot insert readings directly'); exps := exps || 0::bigint; acts := acts || n;

    with u as (update public.alerts set acknowledged_at = now() where id = a_alert returning 1)
      select count(*) into n from u;
    names := array_append(names, 'A cannot update alerts directly'); exps := exps || 0::bigint; acts := acts || n;

    -- ----- Act as owner B -----
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    select count(*) into n from public.trucks;
    names := array_append(names, 'B sees only their 1 truck'); exps := exps || 1::bigint; acts := acts || n;
    select count(*) into n from public.alerts where id = a_alert;
    names := array_append(names, 'B cannot see A''s alert'); exps := exps || 0::bigint; acts := acts || n;

    -- ----- Logged-out visitor (anon key, no login) -----
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    select count(*) into n from public.trucks;
    names := array_append(names, 'Logged-out visitor sees no trucks'); exps := exps || 0::bigint; acts := acts || n;
    select count(*) into n from public.garages;
    names := array_append(names, 'Logged-out visitor sees no garages'); exps := exps || 0::bigint; acts := acts || n;

    -- Throw away all test data.
    raise exception using errcode = 'RLSRB', message = 'rollback test data';
  exception when sqlstate 'RLSRB' then
    null;  -- expected: the test data is now rolled back
  end;

  return query
    select names[i], exps[i], acts[i], case when exps[i] = acts[i] then 'PASS' else 'FAIL' end
    from generate_subscripts(names, 1) as i;
end $$;

select * from pg_temp.rls_check();
