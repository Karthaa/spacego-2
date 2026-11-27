# Staging preflight — 2026-11-25

Target: Supabase project `itbpynkutqdrxspazaxr` ("SpaceGo-Staging", ap-northeast-1).
Migrations under review: `20261120_profiles_auth_hardening.sql`,
`20261121_spacego_rls_hardening.sql`.

Method: read-only `SELECT` statements sent to the Supabase Management API
(`/v1/projects/itbpynkutqdrxspazaxr/database/query`). Nothing was written.
No other project was queried.

## Status

- Read-only preflight: **done** (results below).
- Applying the migrations: **not done**. The attempt to apply
  `20261120_profiles_auth_hardening.sql` was blocked by this machine's
  Claude Code permission settings before anything was sent to the database,
  so staging is unchanged.

## Schema state

| Check | Result |
|---|---|
| `public.profiles` exists | yes, RLS enabled, **0 rows** |
| `auth.users` | **0 users** |
| `profiles.role` type | **`user_role` enum** (`seeker`, `owner`, `admin`) — not TEXT as in `20261108_init.sql` |
| `public.is_admin()` | SECURITY DEFINER, but **no fixed `search_path`** (not hardened yet); also returns true for `service_role` JWTs |
| Trigger on `auth.users` | `on_auth_user_created -> handle_new_user_signup` (always inserts role `seeker`) |
| Trigger on `profiles` | `trg_protect_profile_role -> check_profile_role_update` (blocks role -> admin unless caller is admin or service_role) |
| `profiles` grants | anon and authenticated have **full table privileges** (INSERT/UPDATE/DELETE/TRUNCATE...) |
| Storage buckets | `workspace-images` (public), `avatars` (public), `activation-documents` (private) |
| Other public tables | an older normalised schema also exists (`spaces`, `bookings`, `profiles`, `space_passports`, ...) alongside the seven `spacego_*` tables |

### Current policies

| Table | Policy | Command | Roles |
|---|---|---|---|
| profiles | Admins have full access to profiles | ALL | public |
| profiles | Public profiles are readable by authenticated users | SELECT | public |
| profiles | Users can update their own profile | UPDATE | public |
| spacego_activations, spacego_bookings, spacego_demand_searches, spacego_enquiries, spacego_favourites, spacego_notifications, spacego_spaces | `spacego_demo_all` | ALL | anon, authenticated |

`spacego_demo_all` lets anyone, signed in or not, read and write every row of
all seven app tables. This is what `20261121` replaces.

## Row counts (section 14.1)

| Table | Rows |
|---|---|
| spacego_spaces | 6 |
| spacego_bookings | 3 |
| spacego_activations | 3 |
| spacego_demand_searches | 7 |
| spacego_enquiries | 3 |
| spacego_notifications | 3 |
| spacego_favourites | 2 |

Top-level/payload id mismatches (14.5): **0**. Admin profiles (14.7): **0**.

## Ambiguous / legacy references (14.2–14.4, 14.10, 14.11)

Because there are no profiles yet, every user reference is a legacy demo id:

- **Spaces:** all 6 (`space-1` … `space-6`) have `owner_id = user-owner-1`,
  status `published`. After `20261121` these are **not bookable** and no owner
  can edit them until an admin reassigns them to a real owner profile.
- **Bookings:** all 3 have `user_id = user-seeker-1`, `owner_id = user-owner-1`:
  - `SPG-2026-8941` space-1, approved, 2026-11-12 09:00–18:00 UTC
  - `SPG-2026-8942` space-2, pending, 2026-11-15 14:00–17:00 UTC
  - `SPG-2026-8710` space-4, completed, 2026-10-20 10:00–14:00 UTC
  All timestamps are valid (no inventory lock from 14.11); all referenced spaces
  exist. After the migration only admins can see them.
- **Activations:** owners `user-owner-1` and one with no owner.
- **Enquiries:** all 3 have no `user_id` (admin-only after the migration).
- **Notifications:** 3, for `user-owner-1` / `user-seeker-1` (invisible to
  everyone after the migration).
- **Favourites:** 2, for `user-seeker-1` (invisible after the migration).

## Problems found in the migrations (fixed on `feature/spacego-staging-fixes`)

`20261120_profiles_auth_hardening.sql` would have **failed on staging** as
written:

1. `handle_new_user()` and the profile backfill insert a TEXT value into
   `profiles.role`. On staging that column is the `user_role` enum, and
   Postgres rejects text-to-enum in an INSERT, so the whole migration would
   error (and, had the trigger been installed, every sign-up would fail).
   Fixed by using a `public.profiles.role%TYPE` variable, which works for both
   the TEXT column from `20261108_init.sql` and the enum.
2. Staging's open policy `"Public profiles are readable by authenticated
   users"` (and the two other legacy policies) have different names from the
   ones the migration drops, so they would have survived and kept every
   profile (including emails) readable by any signed-in user. The migration
   now also drops those three names.

`20261121_spacego_rls_hardening.sql` was checked against the staging schema
(enum role comparisons, function signatures, table shapes) and needs no change.

## Notes for applying

- Apply order: `20261120` (fixed version), then `20261121`. Do **not** run
  `20261108_init.sql` on staging; `profiles` already exists with a different
  shape.
- Bootstrapping an admin with SQL is blocked by the existing
  `trg_protect_profile_role` trigger unless the statement runs with
  service_role claims, e.g. inside one transaction:
  `SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);`
  followed by the `UPDATE public.profiles SET role = 'admin' ...`.
- The stage Worker still runs the old `main` code. Once `20261121` is applied,
  that code can no longer read or write the `spacego_*` tables (anon has no
  table access), so staging will look empty/broken until the new branches are
  merged and deployed.
