# Overnight summary (25 to 26 Nov 2026)

The PC session went idle at 17:40 UTC, so the overnight work ran in Claude's
own sandbox on a copy of the repo at `b13f4a3`. All of it is on the branch
`feature/spacego-location`, delivered as a git bundle because the sandbox
can't push to GitHub.

## What works now (tested)

- **Find spaces by location: `/discover`.**
  - Search an area, or press Near me (location is asked for only then).
  - Choose a 1 to 25 km radius, filter by type, price, amenities, capacity, verified and instant, and sort.
  - See results as a list or on a MapLibre map with clusters and price markers.
  - Cards and pins stay in sync, and "Search this area" re-runs the search.
  - On phones there is a list/map toggle and a pin preview.
  - Distances are straight-line and say so. Public points are approximate (about 550 m), so no building can be pinpointed.
- **Listing page:** an approximate-area map and "See other spaces nearby".
- **Listing review:**
  - New listings go to review instead of going live.
  - Admins approve, ask for changes, reject or suspend, with a reason the host sees. Every step is logged.
  - Hosts can't publish or approve their own listings, even by calling the API directly.
- **Host form:**
  - The map pin is required (no more hidden San Francisco default).
  - Real photo uploads to Storage (no more stock photos).
  - A choice of who sees the street address.
- **Address privacy:** the street address is hidden publicly unless the host chooses to show it. Guests see it after the host confirms their booking.

## How it was tested

| Check | Result |
|---|---|
| Typecheck, lint, production build | clean |
| Browser tests in demo mode (incl. accessibility scans in light and dark) | 28 of 28 pass |
| End-to-end on a local copy of the real backend (Supabase Auth, PostgREST, Storage, Postgres + PostGIS) | 23 of 23 pass |
| API abuse attempts | 14 of 14 blocked or correct |
| Storage rules | 7 of 7 |
| SQL test suites | 3 of 3 pass |

## What needs you

See `docs/MORNING_APPROVALS.md`:

1. Revoke the Supabase token you pasted.
2. Push the branch from the bundle.
3. Check production after the PR #6 merge.
4. Approve the four new migrations on staging.

## What isn't done

See section 15 of `docs/IMPLEMENTATION_REPORT.md`. In short:

- verification facts and private documents,
- genuine reviews and reports,
- the 9-step wizard,
- availability and blackout dates,
- the full dashboards.
