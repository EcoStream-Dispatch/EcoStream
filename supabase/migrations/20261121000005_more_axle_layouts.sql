-- =====================================================================
-- Website stage W3: more wheel layouts on the Truck page.
-- Adds 12W (twin steer), 14W (three rear dual axles) and 18W (tractor-trailer).
-- Tyre position names for each layout: frontend/src/lib/tyreLayout.ts
-- =====================================================================

alter table public.trucks drop constraint if exists trucks_axle_config_check;
alter table public.trucks
  add constraint trucks_axle_config_check
  check (axle_config in ('6W', '10W', '12W', '14W', '18W'));
