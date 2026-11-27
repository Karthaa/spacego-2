# SpaceGo MVP: implementation report

Branch: `feature/spacego-location`, stacked on `b13f4a3`. Written 26 Nov 2026,
after an overnight run. This covers what is on this branch. The earlier
branches (auth, data RPCs, design system, front-end polish, staging fixes;
draft PRs #7 to #10) are summarised only where they matter here.

Status words used below:

- **Done, tested** means it runs and was checked by an automated test listed in section 13.
- **Written, not applied** means a database migration exists and passes its tests on a
  local Postgres + PostGIS + Supabase stack, but has **not** been applied to staging or production.
- **Not done** means it is not built.

## 1. What was wrong with the old frontend

Found during the audit. The earlier branches fixed most of it, and this branch fixed the rest.

- **Fake trust signals:** a 5.0 rating on every listing, made-up counts, and verification badges that an admin could pick from a dropdown without recording any check.
- **Fake admin access:** a one-click "admin" login that needed no account.
- **No location search:** search was a client-side text filter, with no map and no distances.
- **Fake host data:** the host form silently placed every new listing at a San Francisco coordinate and offered stock photos as if they were the host's own.
- **No review step:** new listings went live the moment the form was submitted.
- **Public addresses:** the exact street address was public on every listing.
- **No reviews or reports:** there was no way to review a stay or report a listing.
- **Weak design:** inconsistent styling, no dark theme, weak contrast, and missing empty, error and loading states.

## 2. Design changes

**Earlier branches:**

- Design tokens (colour, type scale, spacing, radii, shadows) for light and dark.
- A redesigned home page, search page and workspace page, and restyled dashboards.
- A logo, 404 and error pages, skeletons, toasts and reduced-motion support.

**This branch:**

- **`/discover`:**
  - a list-first layout, with a split list and map at 1024 px and up,
  - a list/map toggle and a pin preview sheet on phones,
  - radius chips, a filters dialog, sort, the result count, and empty and error states,
  - a "Sample data" banner in demo mode.
- **Listing page:**
  - a "Where you'll be" approximate-area map,
  - "What SpaceGo checked" (only the recorded checks),
  - "Guest reviews" with the real average,
  - "Report this listing".
- **Host form:**
  - a map pin picker, real photo uploads and an address-visibility choice,
  - private verification documents.
- **Seeker bookings:** "Address" on confirmed bookings and "Write a review" after a stay.
- **Admin listings:**
  - review queue, reported listings and the "Record checks" dialog,
  - the documents on each listing, opened through signed links.

**Inspection:**

- Screenshots at 1440, 1024, 768 and 390 px, in light and dark.
- Problems found and fixed:
  - the map had zero height,
  - the bottom of the desktop map was cut off,
  - a form was nested inside a form (a hydration error),
  - error messages stayed on screen after they were fixed,
  - Cancel was offered on bookings that had already started,
  - an unlabelled file input.

**Design skills (section 21).**

- I did not run the `npx skills` or `npx impeccable install` installers, because they download and run third-party code.
- Instead, I read the three skills' instruction files from their official repositories and applied them as guidance:
  - **Taste:** list-first layouts and editorial spacing, with no gradients or glass effects.
  - **Impeccable:** the existing tokens reused instead of new ones, contrast checked with axe, and every state designed.
  - **Emil Kowalski:** 150 ms transitions on the standard easing curve, marker and card selection states, press feedback, and every animation switched off under `prefers-reduced-motion`.
- Whether the skills were installed on the PC is **unconfirmed**.
- Lighthouse was not run, because it could not be downloaded here.

## 3. Backend changes (this branch)

There are nine forward-only migrations. All are **written, not applied** to staging or
production. They build on the existing `spacego_*` JSONB tables and on the hardened
view and RPCs from `20261121`. None of them deletes or rewrites existing rows.

| Migration | What it adds |
|---|---|
| `20261126_spacego_geo_search` | PostGIS in the `extensions` schema. A generated `geo_public` geography column (the pin snapped to a ~550 m grid) with a GiST index. `spacego_search_spaces(...)` and `spacego_public_space_point(id)`. |
| `20261127_spacego_listing_review` | The review lifecycle (draft, pending, approved, changes requested, rejected, suspended) and the `spacego_listing_review_events` audit table. A trigger so owners can't publish or approve their own listings. Submit and decide RPCs. |
| `20261128_spacego_listing_photos` | A public `listing-photos` bucket. Owners can write only to their own folder (JPEG, PNG, WebP, 10 MB). |
| `20261129_spacego_address_privacy` | The public view hides the street address and landmark unless the host chose to show them. `spacego_space_address(id)` serves the owner, admins and guests with a confirmed booking. |
| `20261130_spacego_verification_checks` | A badge needs at least one recorded, dated check. Check and badge changes are audited. |
| `20261201_spacego_reviews` | The `spacego_space_reviews` table (one per booking, only after a confirmed stay has ended), host responses and admin moderation. The public reviews and summary views. |
| `20261202_spacego_booking_integrity` | No duplicate overlapping requests from the same guest. `spacego_booking_events` records every status change. |
| `20261203_spacego_listing_reports` | `spacego_listing_reports` with report and resolve RPCs. One open report per person per listing, 10 a day. Admins are notified. |
| `20261204_spacego_listing_documents` | A private `listing-documents` bucket (PDF, JPEG, PNG, 10 MB). The host and admins can read; there are no public URLs. |

## 4. How geolocation works

- The browser is asked for location only when the user presses **Near me** (`src/lib/geo/useGeolocation.ts`). Nothing runs on page load.
- Denied, timeout, unavailable, insecure (non-HTTPS) and unsupported are each handled with a message and the manual search as fallback.
- The coordinates are used only for that search and are not stored. The URL rounds them to 5 decimals.
- **Not done:** reverse geocoding to a place name. The label reads "Your location".

## 5. How nearby search works

- `spacego_search_spaces(lat, lng, radius, categories, price range + unit, amenities, min capacity, verified only, instant only, sort, limit, offset)` is a `SECURITY DEFINER` RPC with `search_path = ''`.
- It reads only through the allowlisted public view, so it sees only published, approved listings. It uses `ST_DWithin` on the indexed `geo_public` column.
- It returns the approximate point and the straight-line distance, rounded to 100 m, plus the total count.
- The radius is clamped to 250 m to 50 km and the page size to 50. The UI offers 1 to 25 km. Sorting is by distance, price or recently updated.
- The UI says "km away (straight line)" and never shows travel times.
- In demo mode, the same filters run on the client over demo data labelled "Sample data".
- **Not done:**
  - an "available on a date" filter,
  - a bounding-box RPC. "Search this area" re-runs the radius search from the map centre.

## 6. Map technology and tiles

- MapLibre GL JS 5, loaded client-side and removed on unmount.
- Clustering, price markers, selection synced between cards and markers in both directions, a recenter button and "Search this area".
- **Tiles:** OpenFreeMap (positron light, dark), with OpenStreetMap / OpenFreeMap attribution. No key is needed.
- **Optional overrides:** MapTiler when `NEXT_PUBLIC_MAPTILER_KEY` is set, and `NEXT_PUBLIC_MAP_STYLE_URL` for any style.
- **Place search:** `/api/geocode` uses MapTiler with a server-only key and is rate-limited per IP. Without a key, the search suggests a built-in list of areas. Public Nominatim is not used.

## 7. How workspace verification works

**Done (written, not applied)**, in four separate parts:

1. **Listing review.**
   - New listings go to review instead of going live.
   - Admins approve, ask for changes, reject or suspend. Every outcome except approval needs a reason of at least 10 characters, which the host sees and is notified about.
   - Every step is logged.
   - Editing a key fact of an approved listing sends it back to review. The key facts are title, type, address, city, pin, capacity, and the choice to show the address publicly.
2. **Recorded checks.**
   - Admins record only what actually happened, with the date: host identity, the host's right to list, permitted use, backup power, fire safety, or a measured internet speed.
   - Guests see exactly those checks, dated, under "What SpaceGo checked".
   - A badge (Reviewed by SpaceGo, Ready, Pro) is refused without at least one dated check, even for an admin calling the API directly.
   - Owners can't set checks or badges.
3. **Private documents.**
   - Hosts can upload a lease or letter of permission, proof of ownership, a business registration or address proof.
   - The files go to a private bucket. Admins open them from the review queue or the checks dialog through 60-second signed links.
   - Hosts are told not to upload Aadhaar, PAN or bank details.
4. **Reports.**
   - Signed-in guests can report a listing.
   - Admins resolve or dismiss each report with a note, or suspend the listing.

**Not done:**

- Address-confirmed, photos-reviewed and site-visit checks.
- Host profile fields (host type, business details, phone verification).
- An internal completeness score.

## 8. Host onboarding journey

1. **Fill in the form.** It asks for:
   - the title, type and description,
   - the address with a **map pin** (required; search, Near me, or click or drag to place it),
   - **who can see the street address**,
   - size, prices, hours and amenities,
   - **photos**: up to 12, with a cover photo, remove, and drag and drop. They are resized in the browser, which also strips GPS data.
   - **private documents** (optional).
2. **Submit.** The listing goes **In review**, not live.
3. **Track the review.**
   - "My properties" shows a status badge, the admin's reason, and Submit or Resubmit.
   - Publish appears only after approval.

**Not done:** the 9-step wizard with autosave, photo reordering, upload progress bars, and availability and blackout dates.

## 9. Booking journey

- **Kept from the earlier branches:**
  - Request to book, with host confirmation, or Instant Book.
  - The server checks the price and the overlap.
  - The host accepts or declines, and both sides get notifications.
- **New on this branch:**
  - The same guest can't send overlapping requests for the same space twice.
  - Every status change is recorded in a history the guest, the host and admins can read.
  - Confirmed guests get an **Address** button with the street address and an "Open in map" link.
  - After a confirmed stay has ended, the guest can **write a review** (one per booking).
  - The booking panel says that no payment is taken on SpaceGo. The 10% service fee shown matches what the server charges.
- **Not done:**
  - blackout dates and operating-hours enforcement,
  - an availability calendar.

## 10. Dashboards

- **Seeker:** Address, Write a review, and their own rating (or that SpaceGo hid it) on each booking. Cancel is no longer offered once a booking has started.
- **Host:**
  - listing review status, reasons, and Submit or Resubmit,
  - document upload,
  - responses to reviews from the listing page.
- **Admin:**
  - Reported listings (Resolve, Dismiss, Suspend),
  - the Waiting for review queue with documents,
  - Record checks,
  - hiding reviews from the listing page.
- **Not done:** the overview counts and "next action" panels, availability management, user management and an audit history screen. The audit data is recorded, but no screen shows it.

## 11. Migrations and where they were applied

| Migration | Local test stack | Staging (`itbpynkutqdrxspazaxr`) | Production (`hxsstsfsqlzqhtfizbcq`) |
|---|---|---|---|
| `20261120_profiles_auth_hardening` | applied | applied by you on 25 Nov | applied 26 Nov, 11:25 IST (the fixed version from `493ff94`; main's older copy fails on production's `user_role` enum) |
| `20261121_spacego_rls_hardening` | applied | applied by you on 25 Nov; checks 15.1 and 15.6 to 15.9 pass (26 Nov) | applied 26 Nov, 11:28 IST; checks 15.1, 15.5, 15.6 to 15.9 pass; row counts unchanged |
| `20261126` to `20261204` (nine files) | applied from scratch, tests pass | applied 26 Nov, ~12:55 IST, as one transaction (`tooling/sql/bundle.mjs`); 7 of 7 test files pass; row counts unchanged | applied 26 Nov, ~13:00 IST, the same script; 7 of 7 test files pass; row counts unchanged; 2 existing accounts untouched |

The apply order and checks are in `docs/history/MORNING_APPROVALS.md`.

## 12. Security policies changed

- **Public reads:** still only through allowlisted views, which never include coordinates, `owner_id`, documents, review state, the street address (unless the host chose to show it), reviewer ids or reporter ids.
- **Writes:** new tables (reviews, reports, booking history, audit) have RLS on and no client write grants. Every write goes through a `SECURITY DEFINER` function with `search_path = ''` that checks who is calling.
- **Admin-only actions:** listing decisions, badges and checks, hiding reviews and closing reports are enforced in the database, not just hidden in the UI.
- **Storage:**
  - Listing photos are public but writable only in the host's own folder.
  - Documents are private: only the host and admins can read them, and only through signed links.

## 13. Tests run and results (26 Nov, from a clean local stack)

| Check | Result |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | clean |
| `npm run build`, in demo mode and against the local backend | exit 0 |
| Playwright suite in demo mode (`e2e/`): axe scans of 8 pages in light and dark, location asked for only after Near me is pressed, discover filters, radius, sort, mobile list/map | **28 of 28 pass** |
| SQL suites in `supabase/tests/` (location search, listing review, address privacy, verification checks, reviews, booking integrity, reports) | **7 of 7 pass** |
| All 13 migrations on a fresh Postgres 16 + PostGIS + GoTrue + Storage (`tooling/local-supabase/up.sh`) | apply cleanly |
| `tooling/local-supabase/e2e-remote.mjs`: real Auth, PostgREST and Storage in a browser, covering discover, host form, admin queue, address, checks, reviews, reports and documents | **46 of 46 pass** |
| `tooling/local-supabase/api-sec.mjs` (direct API abuse attempts) | **26 of 26 as expected** |
| `tooling/local-supabase/storage-test.mjs` (photos and documents) | **18 of 18 as expected** |

**Not run:**

- tests against staging (no access from here, and the new migrations aren't approved),
- Lighthouse,
- real Android devices (Playwright uses a 390 px Chrome viewport).

## 14. Environment variables and credentials still needed

- **Already in use:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Optional:**
  - `MAPTILER_API_KEY` (server-only Worker secret) for real place search.
  - `NEXT_PUBLIC_MAPTILER_KEY` (domain-restricted) for MapTiler tiles.
  - `NEXT_PUBLIC_MAP_STYLE_URL` to override the map style.
- No new secrets are needed for the rest. Storage buckets are created by the migrations.

## 15. What remains incomplete

- **Listing wizard:** the 9-step wizard with autosave, availability and blackout dates, and photo reordering.
- **Verification:** the remaining checks (address confirmed, photos reviewed, site visit), host profile fields and phone verification.
- **Dashboards:** overview counts and next actions, user management, and an audit history screen.
- **Search vocabulary:** the space types and amenities listed in the brief (hot desk, dedicated desk, team space, day pass; 12 amenities). The filters use the existing stored categories and amenity strings.
- **Search features:** the "available on date" filter, reverse geocoding for Near me, and a bounding-box search.
- **Review moderation:** there is no "report review" yet, and no screen to restore a hidden review (the database function supports it). Admins hide a review from the listing page.
- **Known data issue:** the base write guard from `20261121` still stores `rating = 5.0` on owner inserts. The app no longer shows that field (it shows the real review average instead), but a later migration should clear it.

## 16. Was staging deployed and verified?

**Databases yes, sites not yet.** Update, 26 Nov, 13:00 IST:

- The branch is open as draft PR #11. Its nine migrations were applied to staging and then production on 26 Nov (section 11), so both databases are ready for this code. The sites still run `main` until PR #11 is merged.
- Before applying, the setup was rehearsed on a local copy of staging's schema (a `user_role` enum, the `trg_protect_profile_role` trigger, the demo listings). That found the tests' admin-fixture step failing on that trigger; the tests were fixed first.
- PR #6 (merged to `main` on 25 Nov) **did** deploy to production at 16:37 IST. Production then showed no spaces, because its database lacked `20261120`/`20261121`.
- On 26 Nov those two were applied to production (see section 11). All post-apply checks pass, row counts are unchanged, and the production site shows its 6 workspaces again with no console errors.
- Neither staging nor production has an **admin account** yet. On both, the 6 spaces and other rows are demo data owned by placeholder ids (`user-owner-1`) with no profile, so they display, but only an admin can edit them and bookings on them are refused.
- `main` still has the older `20261120`. Use the copy on this branch (or `feature/spacego-staging-fixes`) for any new project.

## Commits on this branch

```
cfd497c Location search: /discover with map, radius, filters and PostGIS RPC
10b0051 Listing page: approximate-area map and "see other spaces nearby"
41b40c8 Listing review: owners submit, admins decide; map pin for hosts
506f559 Host pin picker: don't nest the area search form inside the listing form
1277677 Host photo uploads to Supabase Storage (replaces the stock-photo picker)
bd72620 Local Supabase stack for end-to-end testing (tooling/local-supabase)
27b1769 tooling: drop an unused variable in e2e-remote.mjs
2988185 Address privacy: street address only after the host confirms a booking
f5729df Docs: implementation report, morning approvals, overnight summary
fa797c4 Evidence-backed badges: admins record dated checks; no badge without one
7f5cfd8 Genuine reviews: only after a confirmed stay ends, one per booking
95fca04 Booking integrity: no duplicate requests; history of every status change
d76870c Report a listing: guests report, admins resolve or suspend
9659acf Private verification documents: host uploads, admins open via signed links
```

The docs commit that adds this report comes after these.
