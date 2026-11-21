-- =====================================================================
-- EcoStream seed data (spec section 8). Everything here is FAKE.
--
-- BEFORE running this, create the demo owner's login in Supabase:
--   Dashboard -> Authentication -> Users -> Add user -> Create new user
--   Email: demo.owner@example.com, a password of your choice, tick "Auto Confirm User".
-- (See docs/SUPABASE_SETUP.md.)
--
-- Safe to run more than once: it deletes the previous seed rows first.
--
-- Fixed IDs are used so the simulator and docs can refer to them:
--   Truck 1  11111111-1111-4111-8111-000000000001  (device ...-000000000101)
--   Truck 2  11111111-1111-4111-8111-000000000002  (device ...-000000000102)
-- Devices have no key yet (device_key_hash is NULL). Stage 5 adds a script
-- that creates a key and stores its hash.
--
-- Both trucks have 6 tyres, to match the simulator and acceptance criteria
-- (spec sections 1 and 7: 2 trucks x 6 tyres).
-- =====================================================================

do $$
declare
  owner uuid;
  t1 constant uuid := '11111111-1111-4111-8111-000000000001';
  t2 constant uuid := '11111111-1111-4111-8111-000000000002';
  pos text;
  i int;
begin
  select id into owner from auth.users where email = 'demo.owner@example.com';
  if owner is null then
    raise exception 'Create the user demo.owner@example.com in Authentication -> Users first (see docs/SUPABASE_SETUP.md)';
  end if;

  -- Start clean (cascades to tyres, readings, alerts, devices).
  delete from public.trucks where id in (t1, t2);
  delete from public.garages where name like 'Sample Tyre Works %';

  -- Owner profile
  insert into public.fleet_owners (id, name, phone, company)
  values (owner, 'Demo Owner', null, 'Demo Transport (sample)')
  on conflict (id) do update set name = excluded.name, company = excluded.company;

  -- Login role (stage W2): the demo owner opens the owner portal.
  insert into public.profiles (id, role, full_name)
  values (owner, 'owner', 'Demo Owner')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  -- Optional demo driver / shipper logins (stage W2). Create them first in
  -- Authentication -> Users if you want to try those portals; skipped if missing.
  insert into public.profiles (id, role, full_name)
  select u.id, v.role, v.full_name
  from auth.users u
  join (values ('demo.driver@example.com', 'driver', 'Demo Driver (sample)'),
               ('demo.shipper@example.com', 'shipper', 'Demo Shipper (sample)')) as v(email, role, full_name)
    on u.email = v.email
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  -- Trucks
  insert into public.trucks (id, owner_id, reg_no, make, model, axle_config) values
    (t1, owner, 'TN 99 ZZ 0001', 'Tata', 'Signa 4825.T', '6W'),
    (t2, owner, 'TN 99 ZZ 0002', 'Ashok Leyland', '3520', '6W');

  -- Devices (one per truck, no key yet)
  insert into public.devices (id, truck_id, firmware) values
    ('11111111-1111-4111-8111-000000000101', t1, 'simulator'),
    ('11111111-1111-4111-8111-000000000102', t2, 'simulator');

  -- Tyres: 6 per truck, recommended 830 kPa cold (about 120 psi / 8.3 bar).
  -- Sensor IDs: truck 1 = 1A0001..1A0006, truck 2 = 2A0001..2A0006 (same order as positions).
  i := 0;
  foreach pos in array array['FL', 'FR', 'RL-O', 'RL-I', 'RR-I', 'RR-O'] loop
    i := i + 1;
    insert into public.tyres (truck_id, position, sensor_id, recommended_cold_kpa, max_temp_c) values
      (t1, pos, '1A000' || i, 830, 85),
      (t2, pos, '2A000' || i, 830, 85);
  end loop;
end $$;

-- Garages along Chennai - Krishnagiri - Salem - Namakkal. FAKE names and phone numbers
-- until Rishi collects real verified garages. Opening hours are IST.
insert into public.garages (name, lat, lon, phone, open_24x7, opens, closes, services, verified) values
  ('Sample Tyre Works 1',  13.0475, 80.0960, '+91 90000 00001', true,  null,    null,    '{tyre}', true),  -- Poonamallee
  ('Sample Tyre Works 2',  12.9610, 79.9550, '+91 90000 00002', false, '08:00', '20:00', '{tyre}', true),  -- Sriperumbudur
  ('Sample Tyre Works 3',  12.9300, 79.6400, '+91 90000 00003', true,  null,    null,    '{tyre}', true),  -- near Kanchipuram
  ('Sample Tyre Works 4',  12.9230, 79.3330, '+91 90000 00004', false, '07:00', '22:00', '{tyre}', true),  -- Walajapet
  ('Sample Tyre Works 5',  12.9200, 79.1400, '+91 90000 00005', true,  null,    null,    '{tyre}', true),  -- Vellore
  ('Sample Tyre Works 6',  12.7900, 78.7160, '+91 90000 00006', false, '06:00', '23:00', '{tyre}', true),  -- Ambur
  ('Sample Tyre Works 7',  12.6400, 78.4900, '+91 90000 00007', true,  null,    null,    '{tyre}', true),  -- Natrampalli
  ('Sample Tyre Works 8',  12.5200, 78.2200, '+91 90000 00008', true,  null,    null,    '{tyre}', true),  -- Krishnagiri
  ('Sample Tyre Works 9',  12.1300, 78.1600, '+91 90000 00009', false, '08:00', '21:00', '{tyre}', true),  -- Dharmapuri
  ('Sample Tyre Works 10', 11.9500, 78.1300, '+91 90000 00010', true,  null,    null,    '{tyre}', true),  -- Thoppur
  ('Sample Tyre Works 11', 11.6700, 78.1400, '+91 90000 00011', true,  null,    null,    '{tyre}', true),  -- Salem
  ('Sample Tyre Works 12', 11.4500, 78.1800, '+91 90000 00012', false, '09:00', '19:00', '{tyre}', false), -- Rasipuram
  ('Sample Tyre Works 13', 11.2200, 78.1700, '+91 90000 00013', true,  null,    null,    '{tyre,air_brake,engine}', true); -- Namakkal
