-- =====================================================================
-- Website stage W2: one login, three roles (docs/WEBSITE_SPEC.md section 1, page 5).
--
-- Every login (Supabase Auth user) gets ONE row in public.profiles saying
-- which portal it belongs to: 'owner', 'driver' or 'shipper'.
--
-- Security rules (row-level security is ON):
--   * A logged-in user can READ only their own profile.
--   * A user can UPDATE only their own name and phone. The ROLE column can
--     never be changed by the user (column privileges below), so a driver
--     cannot make themselves an owner.
--   * Nobody but the service role (the API / SQL Editor) can create or delete
--     profiles or change a role. New accounts are set up by EcoStream for now
--     (docs/SUPABASE_SETUP.md), there is no public sign-up.
--
-- Owners keep their row in public.fleet_owners too (trucks point at it).
-- Driver and shipper data tables (trips, shipments) come in stages W4-W6.
-- =====================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'driver', 'shipper')),
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Read own profile only.
create policy "user reads own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Update own profile only ...
create policy "user updates own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ... and only the name and phone columns. Supabase grants everything to
-- `authenticated` by default, so take UPDATE away and give back two columns.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Every existing fleet owner becomes an 'owner' profile.
insert into public.profiles (id, role, full_name, phone)
select id, 'owner', name, phone from public.fleet_owners
on conflict (id) do nothing;
