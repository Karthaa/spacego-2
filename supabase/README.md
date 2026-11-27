# Supabase backend

SpaceGo uses Supabase for two separate concerns:

1. **Authentication and profiles** — Supabase Auth users plus the protected
   `public.profiles` table. This is the source of truth for sessions and roles.
2. **App data** — the `spacego_*` tables used by the client store (listings,
   bookings and their history, reviews, reports, listing review events,
   favourites, enquiries, activations, demand searches, notifications). Each
   has row-level security; clients write only through RLS-guarded tables and
   validated `SECURITY DEFINER` functions (see `docs/ARCHITECTURE.md`).

The older UUID tables from `20261108_init.sql` (`spaces`, `bookings`,
`space_images`, `blocked_slots`, `favourites`, `notifications`,
`property_activation_requests`, `workspace_enquiries`, `demand_searches`) are
unused by the app. `20261207` closes them to the API and keeps their rows.

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

Every migration is forward-only. Apply them in filename order, staging first,
then production, each as one transaction:

| Migration | What it does | Staging | Production |
|---|---|---|---|
| `20261108_init.sql` | First schema: `profiles` and the older UUID tables | applied | applied |
| `20261119_spacego_app_state.sql` | The first `spacego_*` tables | applied | applied |
| `20261120_profiles_auth_hardening.sql` | Profiles, sign-up trigger, role protection | 25 Nov | 26 Nov |
| `20261121_spacego_rls_hardening.sql` | RLS, guarded RPCs and the public view for the app tables | 25 Nov | 26 Nov |
| `20261126` to `20261204` (nine files) | Location search, listing review, photos, address privacy, verification checks, reviews, booking integrity, reports, documents | 26 Nov | 26 Nov |
| `20261205_spacego_new_types_and_demo_flag.sql` | Parking and auditorium types; `is_demo` flag | 26 Nov | 26 Nov |
| `20261206_spacego_whole_venue_pricing.sql` | Halls and event venues priced per booking | 26 Nov | 26 Nov |
| `20261207_spacego_security_hardening.sql` | Closes the unused older tables to the API; fixed `search_path` for the role-guard function | **not yet** | **not yet** |
| `20261208_spacego_rate_limits.sql` | Rate limits on enquiries, search logging, booking requests and property requests | **not yet** | **not yet** |

The dates come from the session reports in `docs/history/` and the checks run
when each was applied. `tooling/sql/bundle.mjs` can join several files into
one transaction for the SQL editor.

**Do not re-run `20261108_init.sql` on an existing project.** The auth
hardening migration (`20261120`) is additive and idempotent. It:

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

`demo/demo_listings_staging.sql` adds 51 demo listings to the test site
(SpaceGo-Staging), each based on a real Kochi place: 39 coworking spaces,
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

`demo/demo_locations_staging.sql` moves 21 demo listings from the centre of
their area to their own building (and corrects IndiQube Paradise's area to
Carnival Infopark, Kakkanad). It's only needed where the demo script ran before
this change; a fresh run of the demo script already uses these locations.

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
- The `spacego_*` tables are protected by row-level security and guarded
  functions (`20261121` onwards), which are the real security boundary: the
  browser holds only the publishable key.

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

## Rate limits

The browser calls Supabase directly with the public key, so the limits live in
the database (`20261208`): a `BEFORE INSERT` trigger on the four tables that
the public and signed-in request functions write to. Windows are fixed and in
UTC.

| Request | Limit | Over the limit |
|---|---|---|
| Enquiry (`spacego_submit_enquiry`) | 5 an hour per email address; 10 an hour and 30 a day per signed-in account; 20 every 10 minutes and 200 a day for all signed-out visitors together | Refused with a message the form shows |
| Search logging (`spacego_log_demand`) | 10 every 10 minutes for the same search; 60 a minute and 10,000 a day in total | Not logged; search still works |
| Booking request (`spacego_create_booking`) | 20 an hour, 60 a day per account | Refused with a message |
| Property request (`spacego_submit_activation`) | 10 an hour, 30 a day per account | Refused with a message |

Only API requests made with the public key or a user's session count. The SQL
editor and the service role are not limited. The counters keep no IP address,
so a flood of signed-out enquiries can use up the shared signed-out limit for
a while; signed-in users still get through. Cloudflare Turnstile checked on a
server route is the next step if that happens. To change a limit, edit
`spacego_rate_limit_guard()` in the migration and run that function again.

## Current environment mapping

- Orun **stage** → Supabase project `SpaceGo-Staging`
- Orun **prod** → Supabase project `spacego-dev` (temporary until a dedicated
  production project exists)

## Tests

Each file in `tests/` runs in one transaction and ends with `ROLLBACK`, so it is
safe on staging (and production) and leaves nothing behind. Every check raises
an exception on failure, and success prints a line ending "all checks passed".

```bash
for f in supabase/tests/*.sql; do
  psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

`security_hardening_test.sql` checks `20261207`: run it after applying that
migration. It also warns about any `SECURITY DEFINER` function without a fixed
`search_path` that was created outside these migrations.

`rate_limits_test.sql` checks `20261208`. It resets the counters inside its
transaction, so for the second or so it runs, other requests that hit the same
counters wait for it.

## Status

Migrations through `20261206` are applied on staging and production (25 and
26 Nov 2026, from the records in `docs/history/` and the checks run then).
Whether each project's dashboard settings above (site URL, redirect URLs,
email templates) are complete isn't recorded here, so check them before
relying on email sign-up and password reset. `20261207` and `20261208` are
written and tested on local copies only.
