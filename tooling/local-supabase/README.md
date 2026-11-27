# Local SpaceGo backend (for testing only)

A throwaway copy of the backend the app talks to in production: Supabase Auth
(GoTrue), PostgREST and Storage in Docker, against a local Postgres 16 with
PostGIS, behind `proxy.mjs` on `http://localhost:54321` (the same URL layout
as a Supabase project: `/auth/v1`, `/rest/v1`, `/storage/v1`).

It never touches staging or production. JWT secret and keys are generated
per run into `$STATE` (default `/tmp/spacego-local`), not into the repo.

Requirements: Docker, Node 22+, and a local Postgres 16 with PostGIS that
you can reach as a superuser (`apt install postgresql-16 postgresql-16-postgis-3`).

```bash
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres ./tooling/local-supabase/up.sh
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$(cat /tmp/spacego-local/anon_key) npm run dev
```

`up.sh` applies every migration in `supabase/migrations` in order, so it is
also the quickest way to check a new migration before it goes to staging.
The SQL checks in `supabase/tests/` run against it too:

```bash
psql -d spacego_local -v ON_ERROR_STOP=1 -f supabase/tests/geo_search_test.sql
psql -d spacego_local -v ON_ERROR_STOP=1 -f supabase/tests/listing_review_test.sql
```

Sign-up email confirmation is switched off locally (autoconfirm), so you can
create test accounts from the app's own sign-up page. Make one an admin with:

```sql
update public.profiles set role = 'admin' where email = 'you@example.test';
```

Stop everything with `docker rm -f sg-gotrue sg-postgrest sg-storage` and
`pkill -f tooling/local-supabase/proxy.mjs`.
