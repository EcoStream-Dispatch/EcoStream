#!/bin/sh
# Rebuild setup_all.sql from migrations/*.sql (run from the supabase/ folder).
set -e
head -n 12 setup_all.sql > setup_all.tmp
for f in migrations/*.sql; do
  printf '\n-- ---------------------------------------------------------------------\n-- FILE: %s\n-- ---------------------------------------------------------------------\n' "$f" >> setup_all.tmp
  cat "$f" >> setup_all.tmp
done
mv setup_all.tmp setup_all.sql
echo "setup_all.sql rebuilt from $(ls migrations/*.sql | wc -l | tr -d ' ') migrations"
