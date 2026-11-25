# Staging preflight — 2026-11-25

Target: Supabase project `itbpynkutqdrxspazaxr` ("SpaceGo-Staging").
Migration under review: `supabase/migrations/20261121_spacego_rls_hardening.sql`.

## Status: not run

No read-only connection to staging could be made from this machine, so none
of the section 14 preflight queries were executed. Nothing was written to any
database, and production (`hxsstsfsqlzqhtfizbcq`) was not contacted.

What was checked:

- Supabase CLI: not installed on Windows or in WSL Ubuntu.
- `~/.supabase` on Windows contains only `telemetry.json` (no access token).
- `psql`: not installed on Windows or in WSL.
- Repository: only `.env.example` and `.dev.vars.example`; no local env file
  with a database connection string.
- A wider search of the user profile for credential files was not permitted
  by this session's permission settings, so it was not attempted further.

## How to run it

Run these as the SQL editor owner on **staging only**, inside a read-only
transaction:

```sql
BEGIN READ ONLY;

-- Prerequisites
SELECT to_regclass('public.profiles') AS profiles_table;
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- Current policies on the seven app tables
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('spacego_spaces','spacego_bookings','spacego_activations',
                    'spacego_demand_searches','spacego_enquiries',
                    'spacego_notifications','spacego_favourites')
ORDER BY tablename, policyname;

-- Storage buckets
SELECT id, public FROM storage.buckets ORDER BY id;

-- Then paste the SELECT statements from section 14 of the migration
-- (skip anything that needs CREATE FUNCTION; inline the logic instead).

ROLLBACK;
```

Items to look for in the results (from the Phase 1B-2 review):

- Spaces whose `owner_id` is not a UUID of an `owner`/`admin` profile (the
  browser seeding used `user-owner-1`): these become unbookable.
- Bookings, enquiries, notifications and favourites keyed to legacy ids such
  as `user-seeker-1`.
- Approved/completed bookings with missing or reversed timestamps: these lock
  the space's inventory after the migration.
