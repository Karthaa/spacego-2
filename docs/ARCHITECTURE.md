# SpaceGo architecture

How the app is put together, where each permission is enforced, and how a
change reaches production. For setup and commands, see the
[README](../README.md); for the database, [supabase/README.md](../supabase/README.md).

## The pieces

```
Browser ──── pages, scripts ───────────────▶ Cloudflare Worker (Next.js through OpenNext)
   │                                             │  src/proxy.ts: refresh auth cookies, send
   │                                             │  signed-out visitors to /auth/login
   │                                             │  server layouts: verify session and role
   │                                             │  /api/geocode ──▶ MapTiler (if configured)
   │                                             │  /auth/callback: email links, PKCE
   │
   ├──── data reads and writes (publishable key) ──▶ Supabase: Postgres + PostGIS, Auth, Storage
   │                                                  row-level security, guarded RPCs, triggers
   │
   └──── map style and tiles ─────────────────────▶ OpenFreeMap (or MapTiler)
```

- **The Worker** serves every page. Most pages are client components; many
  are prerendered at build time. `src/proxy.ts` (Next 16's middleware) runs
  on every page request.
- **The browser talks to Supabase directly**, through one client-side store
  (`src/lib/data/store.ts` with `src/lib/data/remote.ts`). It uses the
  publishable key, which every visitor can see, so the database has to
  enforce every rule itself.
- **Demo mode:** without Supabase settings the store uses sample data in
  `localStorage` (`src/lib/data/mockData.ts`), and sign-in is unavailable.

## Data

The app's data lives in `spacego_*` tables (listings, bookings and their
history, reviews, reports, listing review events, favourites, enquiries,
activations, demand searches, notifications). Each row keeps its record as
JSON, with the columns that rules and indexes need. `profiles` holds each
user's role. Nine older tables from the first migration are unused and
closed to the API (migration 20261207).

How reads and writes are allowed:

| What | How |
|---|---|
| Public listings | `spacego_public_spaces`, a `security_barrier` view that leaves out private fields and rounds the map point; exact addresses come only from `spacego_space_address()` for the right people |
| Search | `spacego_search_spaces()` (PostGIS radius search with filters) |
| Listings and favourites | Direct writes, limited by RLS and the `spacego_guard_space_write` trigger (owners edit their own; key changes send a listing back to review) |
| Everything else | `SECURITY DEFINER` functions with `search_path = ''` that check who is calling: bookings, reviews, reports, enquiries, listing review, verification checks |
| Files | Storage buckets `listing-photos` (public) and `listing-documents` (private, signed links); 10 MB and fixed file types |

## Sign-in and roles

- Supabase Auth with email and password; email links come back through
  `/auth/callback` (PKCE code exchange, or token hash).
- The role (`seeker`, `owner`, `admin`) lives in `profiles`. Sign-up can only
  create `seeker` or `owner`; users can't update their own role; admins are
  promoted by hand.
- `src/proxy.ts` only redirects. The real checks are in the server layouts of
  `/dashboard`, `/owner` and `/admin` (`src/lib/auth/server.ts`): they verify
  the session with `getClaims()` and read the role from `profiles`.
- Redirect targets after sign-in must be same-site paths (`safeNextPath`), and
  redirect hosts are checked against `NEXT_PUBLIC_SITE_URL` (`requestOrigin`).

## Security layers

1. **Database:** RLS on every table, guarded functions, triggers, sanitised
   views (above), and rate limits on enquiries, search logging, booking
   requests and property requests (migration 20261208). Tested by
   `supabase/tests/`.
2. **HTTP headers** on every page (`src/lib/security-headers.ts`, applied in
   `next.config.ts`): HSTS, `nosniff`, no framing, Referrer-Policy,
   Permissions-Policy, COOP, and a Content-Security-Policy. The safe part of
   the CSP is enforced; the full policy is report-only until a build sets
   `CSP_MODE=enforce`. Files under `/_next/static` are served by Cloudflare's
   asset store and don't carry these headers.
3. **Server-only secrets** (for example `MAPTILER_API_KEY`) stay in the
   Worker; only `NEXT_PUBLIC_*` values reach the browser.
4. **CI** (`.github/workflows/ci.yml`): lint, types, unit and browser tests,
   and a gitleaks scan of the whole history on every pull request.

## Environments and deploys

| Orun environment | Site | Supabase project | Deployed when |
|---|---|---|---|
| `stage` | the test site, with labelled demo listings | SpaceGo-Staging | every merge to `main` |
| `prod` | production | the project currently used as production | after `stage` succeeds on the same commit |

`intent.yaml` declares both environments and their public build values.
`.github/workflows/orun.yml` plans each run and executes one job per lane
using the compositions in `infra/stack/`: install, build the Worker
(`npm run build:worker`), check the output, and on `main` deploy it with
Wrangler and smoke-test the home page. Pull requests build and check without
deploying.

Migrations are applied by hand in the Supabase SQL editor, staging first.
The pipeline never touches the database.

## Where to look

| Topic | Files |
|---|---|
| Routes | `src/app/` |
| Auth | `src/context/AuthContext.tsx`, `src/lib/auth/`, `src/proxy.ts`, `src/app/auth/` |
| Data access | `src/lib/data/store.ts`, `src/lib/data/remote.ts` |
| Search and maps | `src/lib/geo/`, `src/components/discover/` |
| Security headers | `src/lib/security-headers.ts`, `next.config.ts` |
| Database | `supabase/migrations/`, `supabase/tests/` |
| Deploys | `intent.yaml`, `.github/workflows/orun.yml`, `infra/stack/`, `wrangler.template.jsonc` |
