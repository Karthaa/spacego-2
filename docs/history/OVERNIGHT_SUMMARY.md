# Overnight summary (25 to 26 Nov 2026)

The PC session went idle at 17:40 UTC, so the overnight work ran in Claude's
own sandbox on a copy of the repo at `b13f4a3`. All of it is on the branch
`feature/spacego-location`, delivered as a git bundle because the sandbox
can't push to GitHub.

Nothing was pushed, merged, deployed or applied to staging or production.

## What works now (tested on a local copy of the real backend)

- **Find spaces by location: `/discover`.**
  - Search an area, or press Near me (location is asked for only then).
  - Choose a 1 to 25 km radius, filter by type, price, amenities, capacity, verified and instant, and sort.
  - See results as a list or on a MapLibre map with clusters and price markers.
  - Cards and pins stay in sync, and "Search this area" re-runs the search.
  - On phones there is a list/map toggle and a pin preview.
  - Distances are straight-line and say so. Public points are approximate (about 550 m), so no building can be pinpointed.
- **Listing page:** an approximate-area map, "See other spaces nearby", what SpaceGo checked, guest reviews and "Report this listing".
- **Listing review:**
  - New listings go to review instead of going live.
  - Admins approve, ask for changes, reject or suspend, with a reason the host sees. Every step is logged.
  - Hosts can't publish or approve their own listings, even by calling the API directly.
- **Host form:**
  - The map pin is required (no more hidden San Francisco default).
  - Real photo uploads to Storage (no more stock photos).
  - A choice of who sees the street address.
  - Private verification documents (lease, ownership proof, registration, address proof).
- **Address privacy:** the street address is hidden publicly unless the host chooses to show it. Guests see it after the host confirms their booking.
- **Evidence-backed badges:**
  - Admins record what SpaceGo actually checked, with the date, and can open the host's documents through short-lived links.
  - Guests see exactly those checks.
  - The database refuses a badge with no recorded check.
- **Genuine reviews:**
  - Only a guest whose confirmed stay has ended can review, once per booking.
  - Hosts can respond, and admins can hide a review with a reason.
  - The listing shows the real average, or "No reviews yet".
- **Booking integrity:** no duplicate overlapping requests, and a history of every status change.
- **Reports:** guests report a listing, and admins resolve, dismiss or suspend it.

## How it was tested

| Check | Result |
|---|---|
| Typecheck, lint, production build | clean |
| Browser tests in demo mode (incl. accessibility scans in light and dark) | 28 of 28 pass |
| End-to-end on a local copy of the real backend (Supabase Auth, PostgREST, Storage, Postgres + PostGIS) | 46 of 46 pass |
| API abuse attempts | 26 of 26 blocked or correct |
| Storage rules (photos and documents) | 18 of 18 |
| SQL test suites | 7 of 7 pass |

## What needs you

See `docs/history/MORNING_APPROVALS.md`:

1. Revoke the Supabase token you pasted.
2. Push the branch from the bundle.
3. Check production after the PR #6 merge.
4. Approve the nine new migrations on staging.

## What isn't done

See section 15 of `docs/history/IMPLEMENTATION_REPORT.md`. In short:

- the 9-step wizard, with availability and blackout dates,
- the remaining checks and host profile fields,
- the full dashboards (overview, user management, audit history),
- the brief's space-type and amenity vocabulary,
- the "available on date" filter.
