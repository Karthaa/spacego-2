# Supabase backend

SpaceGo uses Supabase for two separate concerns:

1. **Authentication and profiles** — Supabase Auth users plus the protected
   `public.profiles` table. This is the source of truth for sessions and roles.
2. **App-state collections** — the seven `spacego_*` JSONB tables used by the
   existing client store. These intentionally remain separate from the older
   UUID/Auth `spaces` schema.

## Environment variables

The browser needs the public project URL and key at build time:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy fallback, still supported)

The app resolves the publishable key first and falls back to the anon key.
Placeholder values are rejected with a descriptive error; there are no silent
fallbacks to fake authentication. Never put a service-role key in any
`NEXT_PUBLIC_*` variable or in `intent.yaml`.

Local development: copy `.env.example` to `.env.local` and fill the values.

Stage/prod: the values live in `intent.yaml` under each environment's `env`
block. They are build-time values, not Worker runtime secrets, because Next
inlines `NEXT_PUBLIC_*` during `next build`.

## Migrations

Run migrations manually in the Supabase SQL editor (or with the CLI) as the
table owner. The application never executes migrations.

Apply in this order on a project that does not have the schema yet:

1. `migrations/20261108_init.sql` — base `profiles`/`spaces` schema.
2. `migrations/20261119_spacego_app_state.sql` — the seven `spacego_*` tables.
3. `migrations/20261120_profiles_auth_hardening.sql` — additive auth hardening.

**Do not re-run `20261108_init.sql` on an existing project.** The hardening
migration is additive and idempotent. It:

- Replaces `public.is_admin()` with a `SECURITY DEFINER` function that has a
  fixed empty `search_path`.
- Creates `public.handle_new_user()` and the `on_auth_user_created` trigger so
  every new `auth.users` row gets a profile.
- Backfills profiles only for auth users that are missing one.
- Keeps `updated_at` current.
- Replaces the permissive profile policies with own-row read and authorised
  admin read.
- Grants authenticated users updates only on `full_name`, `phone`,
  `company_name`, and `avatar_url`. `role`, `email`, and `id` are not writable
  by clients, so a user cannot self-promote to admin.
- Rejects any signup metadata role other than `seeker` or `owner`; anything
  else, including a forged `admin`, becomes `seeker`.

The first administrator must be promoted manually with the SQL editor or
service role:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'ops@example.com';
```

## Demo listings (test site only)

`demo/demo_listings_staging.sql` adds 39 demo listings to the test site
(SpaceGo-Staging), each based on a real Kochi place: 27 coworking spaces,
6 halls and 6 car parks. Every listing is marked `is_demo`. Its text says the
venue hasn't joined SpaceGo, and its photos, prices and capacity are samples.
None has a verification badge, rating or reviews. All are Instant Book, so the
whole booking flow can be tried. The script also takes the six made-up sample
listings offline on the test site. It runs as one transaction, and re-running
it skips listings that already exist.

Run things in this order:

1. On staging, `migrations/20261205_spacego_new_types_and_demo_flag.sql` (adds
   the parking and auditorium types and the `is_demo` flag), then
   `demo/demo_listings_staging.sql`.
2. On production, the same migration, before PR #14 merges. The app's new
   types need it.
3. On staging and then production, `migrations/20261206_spacego_whole_venue_pricing.sql`
   (halls and event venues are priced per booking, not per guest). It needs
   20261205 first, and the app's price preview in PR #14 assumes it.
4. Never run the demo script on production. It refuses to run there: it
   recognises production by the earlier step that took production's six
   made-up sample listings offline, which the test site never had.

To remove the demo listings later, run the commented block at the end of the
script on its own.

## Authentication flow

- Registration collects full name, email, password, and an optional phone and
  company. Public registration can only create `seeker` or `owner`.
- When email confirmation is enabled, registration shows a "check your email"
  state and does not treat the user as signed in until a session exists.
- Login uses `signInWithPassword` and shows actionable errors.
- Password recovery sends `resetPasswordForEmail`; the email link lands on
  `/auth/callback`, exchanges the PKCE code (or verifies a token hash), then
  sends the user to `/auth/reset-password` to call `updateUser`.
- Sign-out clears the Supabase cookies and refreshes the server render.

## Route protection

- `src/proxy.ts` refreshes auth cookies and performs an optimistic redirect for
  unauthenticated visitors to `/dashboard`, `/owner`, and `/admin`.
- The authoritative checks are the server layouts. They verify the session with
  `getClaims()` and read the role from `public.profiles`, never from
  `user_metadata`.
- `/owner` requires the `owner` role. `/admin` requires the `admin` role.
  Unauthorised users are redirected to their own portal.
- The `spacego_*` tables still use permissive demo RLS. They are not a security
  boundary for user data; do not store secrets there.

## Required Supabase Dashboard settings

For each project, under **Authentication → URL Configuration**:

- Set **Site URL** to the deployed origin, for example
  `https://stage.example.com`.
- Add redirect URLs for every environment:
  - `http://localhost:3000/auth/callback`
  - `https://<stage-origin>/auth/callback`
  - `https://<prod-origin>/auth/callback`

Under **Authentication → Providers → Email**:

- Enable the Email provider.
- Decide whether **Confirm email** is required. If enabled, configure SMTP or
  use the built-in sender for testing, and make sure the confirmation template
  links through `/auth/callback`.
- Configure the password recovery template the same way.

Under **Authentication → Signing Keys**:

- The current `getClaims()` flow verifies JWTs locally when asymmetric signing
  keys are available. If the project still uses legacy symmetric keys, the
  client falls back to the Auth server. Rotate to asymmetric keys when possible.

## Current environment mapping

- Orun **stage** → Supabase project `SpaceGo-Staging`
- Orun **prod** → Supabase project `spacego-dev` (temporary until a dedicated
  production project exists)

## Verification status

The app-state tables have been deployed and exercised on stage and prod. The
profile hardening migration has **not** been applied to either project as part
of this change, so real end-to-end registration, profile creation, and role
authorisation still require:

1. Applying `20261120_profiles_auth_hardening.sql` manually.
2. Configuring the Dashboard URLs and email templates above.
3. Testing with real staging accounts, including promoting one admin profile.

Until then, treat real authentication as implemented but not yet
staging-verified.
