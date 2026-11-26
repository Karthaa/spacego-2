# SpaceGo

**Find the right space.** SpaceGo is a marketplace for flexible spaces in
Kochi: coworking desks, private offices, meeting and training rooms, studios,
event spaces, auditoriums and parking. Guests search by area or "Near me",
compare listings on a map, and request or instantly book. Hosts list and run
their spaces, and admins review listings before they go live.

| Site | URL | Notes |
|---|---|---|
| Test site (stage) | https://spacego-2-web-stage.orun-pool-9b971c2c.workers.dev | Carries labelled demo listings; not indexed by search engines |
| Production | https://spacego-2-web-prod.orun-pool-9b971c2c.workers.dev | |

## What it does

- **Search** (`/discover`, `/spaces`): by area, by radius, or from the
  visitor's location, which is asked for only when they press "Near me". Maps
  show an approximate point; the street address stays hidden unless the host
  shows it or confirms a booking.
- **Listings** (`/spaces/[id]`): photos, prices by the hour, day or month
  (auditoriums and event spaces by the booking, parking by the vehicle),
  amenities, the checks an admin actually recorded (a badge appears only for
  what was checked), reviews from guests whose confirmed stay has ended, and
  "Report this listing".
- **Bookings:** request or instant book. The database refuses overlapping
  bookings and keeps a history of every status change.
- **Hosts** (`/owner`): listings (each reviewed by an admin before it is
  published), photos and documents, availability, bookings, performance.
- **Guests** (`/dashboard`): bookings, saved spaces, enquiries, profile.
- **Admins** (`/admin`): listing review, verification checks, reports,
  bookings, users, activation requests and demand insights.
- **Property activation** (`/activation`): owners of idle space ask SpaceGo to
  help turn it into a bookable workspace.

## Tech stack

| | |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4 |
| Backend | Supabase: Postgres with PostGIS, Auth, Storage |
| Maps | MapLibre GL JS with OpenFreeMap tiles (MapTiler optional) |
| Hosting | Cloudflare Workers, through OpenNext |
| CI/CD | GitHub Actions: `ci.yml` (checks) and `orun.yml` (Orun deploys) |
| Tests | Node's test runner, Playwright with axe-core, SQL test scripts |

How the pieces fit together, and where each permission is enforced, is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run it locally

You need Node 22 (see `.nvmrc`) and npm.

```bash
npm ci
npm run dev        # http://localhost:3000
```

With no Supabase settings the app runs in **demo mode**: sample listings kept
in your browser, and no sign-in, so `/dashboard`, `/owner` and `/admin` don't
work. To use a real backend, copy `.env.example` to `.env.local` and fill in
the project URL and publishable key; use the staging project or your own,
never production. Every variable is described in `.env.example`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build, and serving it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output files |
| `npm run test:unit` | Unit tests in `tests/unit/` (Node's built-in runner) |
| `npm run test:e2e` | Playwright smoke, search and accessibility tests against a demo-mode production build. Run `npm run build` first. `PLAYWRIGHT_CHANNEL=chrome` uses an installed Chrome; otherwise run `npx playwright install chromium` once. |
| `npm run build:worker` | The Cloudflare Worker, built the way the deploy pipeline builds it |
| `npm run preview:worker` | Runs that Worker locally |

The database tests in `supabase/tests/` run with `psql` against staging or a
local copy. Each one runs in a transaction that is rolled back, so it leaves
nothing behind. See [supabase/README.md](supabase/README.md).

## Deploys

[Orun](intent.yaml) runs the pipeline in `.github/workflows/orun.yml`:

1. A pull request builds and checks the Worker for each environment. It
   deploys nothing.
2. A merge to `main` deploys the test site, smoke-tests it, then deploys
   production. **Merging is deploying.**

Database migrations are never run by the pipeline. Apply each one by hand in
the Supabase SQL editor, staging first and then production, before the code
that needs it merges; [supabase/README.md](supabase/README.md) has the order.

Per-environment values (site URL, Supabase URL and publishable key) live in
`intent.yaml`. They are public browser values; secrets never go there.

## Project layout

```
src/app/              routes: public pages, auth, /dashboard, /owner, /admin, /api/geocode
src/components/       UI, grouped by area
src/context/          auth and data providers
src/lib/              auth helpers, Supabase clients, data store, geo, pricing, security headers
supabase/migrations/  forward-only database migrations
supabase/tests/       SQL tests
supabase/demo/        demo listings for the test site only
e2e/                  Playwright tests
tests/unit/           unit tests
infra/stack/          Orun compositions for the Worker build and deploy
tooling/              local Supabase stack, SQL bundler, Wrangler config renderer
docs/                 architecture, design system, dated session reports
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data flow, auth, security layers, environments
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): design tokens and components
- [supabase/README.md](supabase/README.md): backend setup, migrations and their order, auth settings
- [CONTRIBUTING.md](CONTRIBUTING.md): how to make and ship a change
- [SECURITY.md](SECURITY.md): reporting a vulnerability, handling secrets
- [docs/history/](docs/history/README.md): dated reports from earlier work sessions

## License

All rights reserved by the owner. The code is public to read, but there is no
open-source licence, so it may not be reused without permission.
