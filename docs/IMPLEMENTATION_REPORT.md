# SpaceGo MVP: implementation report

Branch: `feature/spacego-location` (stacked on `b13f4a3`). Written 26 Nov 2026,
after an overnight run. This covers what is on this branch. The earlier
branches (auth, data RPCs, design system, front-end polish, staging fixes;
draft PRs #7 to #10) are summarised only where they matter here.

Status words used below:

- **Done, tested** means it runs and was checked by an automated test listed in section 13.
- **Written, not applied** means a database migration exists and passes its tests on a
  local Postgres + PostGIS + Supabase stack, but has **not** been applied to staging or production.
- **Not done** means it is not built.

## 1. What was wrong with the old frontend

Found during the audit (mostly fixed on the earlier branches):

- Fake trust signals: ratings of 5.0 on every listing, made-up counts, and verification badges with nothing behind them.
- A one-click "admin" login that needed no account.
- Search was a client-side text filter. There was no location search, no map, and no distances.
- The host form silently placed every new listing at a San Francisco coordinate and offered stock photos as if they were the host's own.
- New listings went live the moment the form was submitted, with no review.
- Exact street addresses were public on every listing.
- Inconsistent styling across pages, no dark theme, weak contrast in places, and no empty, error or loading states.

## 2. Design changes

- Earlier branches: design tokens (colour, type scale, spacing, radii, shadows) for light and dark, a redesigned home page, search and workspace pages, restyled dashboards, a logo, 404 and error pages, skeletons, toasts and reduced-motion support.
- This branch:
  - **`/discover`**: a list-first layout with a split list and map at 1024 px and up, plus a list/map toggle and a pin preview sheet on phones. It includes radius chips, a filters dialog, sort, the result count, empty and error states, and a "Sample data" banner when the app runs without a backend.
  - **Listing page**: a "Where you'll be" section with an approximate-area map.
  - **Host form**: a map pin picker, real photo uploads and an address-visibility choice.
  - **Review screens**: review status badges and reasons for hosts, and a review queue with a reason dialog for admins.
- Checked by screenshots at 1440, 1024, 768 and 390 px, in light and dark. Problems found and fixed:
  - the map had zero height,
  - the bottom of the desktop map was cut off,
  - a form was nested inside a form (a hydration error),
  - a Playwright locator was ambiguous.

**Design skills (section 21).** I did not run the `npx skills` or `npx impeccable install` installers, because they download and run third-party code. I read the three skills' instruction files from their official repositories and applied them as guidance:

- **Taste:** a list-first layout and editorial spacing, with no gradients or glass effects.
- **Impeccable:** the existing tokens reused instead of new ones, contrast checked with axe, and every state designed.
- **Emil Kowalski:** 150 ms transitions on the standard easing curve, marker and card selection states, press feedback, and every animation switched off under `prefers-reduced-motion`.

Whether the skills were installed on the PC is **unconfirmed**. Lighthouse was not run, because it could not be downloaded here.

## 3. Backend changes (this branch)

Four forward-only migrations. All are **written, not applied** to staging or production.

| Migration | What it adds |
|---|---|
| `20261126_spacego_geo_search.sql` | PostGIS in the `extensions` schema. A generated `geo_public` geography column (the pin snapped to a ~550 m grid) with a GiST index. The `spacego_search_spaces(...)` and `spacego_public_space_point(id)` RPCs. |
| `20261127_spacego_listing_review.sql` | The listing review lifecycle and an append-only `spacego_listing_review_events` audit table. A trigger that stops owners publishing or approving their own listings. The `spacego_submit_listing_for_review` and `spacego_review_listing` RPCs. |
| `20261128_spacego_listing_photos.sql` | A `listing-photos` Storage bucket (public read, JPEG/PNG/WebP, 10 MB) and policies so owners can write only to their own folder. |
| `20261129_spacego_address_privacy.sql` | The public view hides the street address and landmark unless the host chose to show them. `spacego_space_address(id)` returns the address and exact pin only to the owner, admins, and guests with a confirmed or completed booking. |

All four build on the existing `spacego_*` JSONB tables and the hardened view and RPCs from `20261121`. None of them deletes or rewrites existing rows.

## 4. How geolocation works

- The browser is asked for location only when the user presses **Near me** (`src/lib/geo/useGeolocation.ts`). Nothing runs on page load.
- Denied, timeout, unavailable, insecure (non-HTTPS) and unsupported are each handled with a message and the manual search as fallback.
- The coordinates are used only for that search. They are rounded in the URL to 5 decimals (about 1 m), they are not stored, and they are not sent anywhere except the search RPC.
- **Not done:** reverse geocoding to a place name. The label reads "Your location".

## 5. How nearby search works

- `spacego_search_spaces(lat, lng, radius, categories, price range + unit, amenities, min capacity, verified only, instant only, sort, limit, offset)` is a `SECURITY DEFINER` RPC with `search_path = ''`.
- It reads only through the allowlisted public view, so it only ever sees published, approved listings. It uses `ST_DWithin` on the indexed `geo_public` column.
- It returns the approximate point and the straight-line distance, rounded to 100 m, plus the total count.
- The radius is capped at 250 m to 50 km and the page size at 50. Sorting is by distance, price or recently updated.
- The UI labels distances "km away (straight line)" and never shows travel times.
- Without the migration, or in demo mode, the same filters run on the client over demo data, labelled "Sample data" (`searchLocal` in `src/lib/data/store.ts`).
- **Not done:**
  - an "available on a date" filter,
  - a bounding-box RPC. "Search this area" re-runs the radius search from the map centre instead.

## 6. Map technology and tiles

- MapLibre GL JS 5, loaded client-side with a dynamic import and removed on unmount.
- Clustering, price-label markers, selection synced between cards and markers in both directions, a recenter button and "Search this area".
- Default tiles: OpenFreeMap (positron light, dark), with OpenStreetMap / OpenFreeMap attribution. No key is needed.
- If `NEXT_PUBLIC_MAPTILER_KEY` is set, the map uses MapTiler. `NEXT_PUBLIC_MAP_STYLE_URL` overrides the style.
- Place search uses `/api/geocode` (MapTiler, server-only key, rate-limited per IP). Without a key, the search suggests a built-in list of areas (Kochi neighbourhoods and major cities). Public Nominatim is not used.

## 7. How workspace verification works

- **Done (written, not applied):**
  - The listing lifecycle: `draft` → `pending` → `approved` → published, plus `changes_requested`, `rejected` and `suspended`.
  - Only admins decide, through an RPC. Asking for changes, rejecting and suspending need a written reason of at least 10 characters.
  - Every transition is written to the audit table. The host sees the reason and gets a notification.
  - Editing a key fact of an approved listing sends it back to review. The key facts are title, type, address, city, pin, capacity, and the choice to show the address publicly.
  - Owners cannot publish unapproved listings or forge an approval, through the app or directly through the API. The tests cover both.
- **Not done:**
  - separate verification facts (host identity, authority, documents, address confirmed, photos reviewed, site visit),
  - private document upload and review with signed URLs,
  - host profile fields (host type, business details),
  - the internal completeness score.

## 8. Host onboarding journey

1. **Fill in the form.** It asks for the title, type and description, the address with a **map pin** (required, with search, Near me, and click or drag to place), and **who can see the street address**. Then size, prices, hours and amenities, and **photos** (up to 12, with a cover photo, remove, and drag and drop; resized in the browser and uploaded to Storage).
2. **Submit.** The listing goes **In review**, not live.
3. **Track the review.** "My properties" shows a status badge, the admin's reason, and Submit or Resubmit. Publish appears only after approval.

**Not done:** the 9-step wizard with autosave, photo reordering, upload progress bars, availability and blackout dates, and the verification documents step.

## 9. Booking journey

- **Unchanged from the hardened RPCs on the earlier branches:**
  - Request to book, with host confirmation, or Instant Book.
  - The server checks the price and the overlap.
  - The host accepts or declines, and both sides get notifications.
- **New on this branch:**
  - Confirmed guests get an **Address** button with the street address and an "Open in map" link.
  - Pending, declined and cancelled requests don't unlock it.
  - The booking panel now says that no payment is taken on SpaceGo.
  - The 10% service fee shown matches what the server charges in `spacego_create_booking`.
- **Not done:**
  - blackout dates and operating-hours enforcement,
  - duplicate-request protection,
  - a status history table,
  - an availability calendar.

## 10. Dashboards

- **Seeker:** the **Address** action on confirmed bookings.
- **Host:** listing review status, reasons, and Submit or Resubmit.
- **Admin:** a "Waiting for review" queue with Approve, Request changes and Reject, plus Suspend for live listings.
- **Not done:** the seeker, host and admin consoles described in sections 10 to 12 of the brief (overview counts, availability management, user management, document review, reports, review moderation, and an audit history view).

## 11. Migrations and where they were applied

| Migration | Local test stack | Staging (`itbpynkutqdrxspazaxr`) | Production (`hxsstsfsqlzqhtfizbcq`) |
|---|---|---|---|
| `20261120_profiles_auth_hardening` | applied | applied by you on 25 Nov (post-apply checks not confirmed) | **not applied** |
| `20261121_spacego_rls_hardening` | applied | applied by you on 25 Nov (post-apply checks not confirmed) | **not applied** |
| `20261126_spacego_geo_search` | applied, tests pass | not applied | not applied |
| `20261127_spacego_listing_review` | applied, tests pass | not applied | not applied |
| `20261128_spacego_listing_photos` | applied, tests pass | not applied | not applied |
| `20261129_spacego_address_privacy` | applied, tests pass | not applied | not applied |

The apply order and checks are in `docs/MORNING_APPROVALS.md`.

## 12. Security policies changed

- **Public listings:** they are still read only through the allowlisted view. The view now also hides the street address and landmark unless the host chose to show them.
- **Search RPCs:** they never return coordinates or `owner_id`, only a ~550 m snapped point.
- **Review:**
  - Hosts can't publish, approve or forge a review state. A trigger enforces this alongside the existing RLS and the write guard.
  - Only admins can call the decision RPC.
  - The audit table can be read by admins only.
- **Storage:** owners can upload only into `listing-photos/<their uid>/` with image types and a 10 MB limit. Seekers and anonymous users can't upload. Other users' folders can't be listed.
- **Address RPC:** only the owner, admins, and guests with a confirmed or completed booking get a row.

## 13. Tests run and results (26 Nov, from a clean local stack)

| Check | Result |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | clean |
| `npm run build` (demo mode, and against the local backend) | exit 0 |
| Playwright suite in demo mode (`e2e/`): axe scans of 8 pages incl. `/discover` in light and dark, "no location until Near me is pressed", discover filters, radius, sort, mobile list/map | **28 of 28 pass** |
| SQL: `supabase/tests/geo_search_test.sql` | pass |
| SQL: `supabase/tests/listing_review_test.sql` | pass |
| SQL: `supabase/tests/address_privacy_test.sql` | pass (and fails against the old view, as it should) |
| All 8 migrations on a fresh Postgres 16 + PostGIS; geo and address migrations re-run | apply cleanly |
| `tooling/local-supabase/e2e-remote.mjs` (real Auth, PostgREST, Storage; browser) | **23 of 23 pass** |
| `tooling/local-supabase/api-sec.mjs` (direct API abuse attempts) | **14 of 14 as expected** |
| `tooling/local-supabase/storage-test.mjs` | **7 of 7 as expected** |

**Not run:**

- tests against staging (no access from here and no approval for the new migrations),
- Lighthouse,
- real Android devices (Playwright uses a 390 px Chrome viewport).

## 14. Environment variables and credentials still needed

- **Already in use:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Optional:**
  - `MAPTILER_API_KEY` (server-only Worker secret) for real place search.
  - `NEXT_PUBLIC_MAPTILER_KEY` (domain-restricted) for MapTiler tiles.
  - `NEXT_PUBLIC_MAP_STYLE_URL` to override the map style.
  - Without these, the map uses OpenFreeMap and the search suggests a built-in list of areas.

## 15. What remains incomplete

- Separate verification facts, private document upload and review, and host profile and verification.
- Genuine reviews tied to completed bookings (with host response and moderation), and reports for listings and reviews.
- The 9-step listing wizard with autosave, availability and blackout dates, and photo reordering.
- Booking: duplicate-request protection, a status history table, and an availability calendar.
- Full seeker, host and admin consoles (overview counts, user management, document review, audit view).
- The space-type and amenity vocabulary the brief lists (hot desk, dedicated desk, team space, day pass; 12 amenities). Filters currently use the existing stored categories and amenity strings.
- The "available on date" filter and reverse geocoding for Near me.
- Known data issue: the base write guard from `20261121` sets `rating = 5.0` on owner inserts. The UI doesn't show ratings, but the stored value is not genuine and should be removed in a later migration.

## 16. Was staging deployed and verified?

**No.**

- Nothing from this branch has been deployed or pushed. The sandbox can't reach GitHub for this repo, Supabase or Cloudflare.
- The PC session that can push went idle at 17:40 UTC on 25 Nov.
- Separately, `feature/spacego-design-batch2` was merged to `main` as PR #6 on 25 Nov. If the Orun workflow is on, that deploys to production. Whether it deployed, and whether production works without the `20261120`/`20261121` migrations, is **unverified**.

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
```
