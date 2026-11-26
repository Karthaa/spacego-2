# Morning approvals (26 Nov 2026)

These are the things that were waiting on you, in order. Each step is safe to stop after.

**Status, 26 Nov, 11:30 IST:** steps 1 to 3 are done, and the production part of
step 5 is done for `20261120`/`20261121` only. What's left is step 4 (the nine new
migrations on staging) and an admin account on production.

- Step 1: token revoked.
- Step 2: branch pushed; draft PR #11.
- Step 3: PR #6 had deployed to production, which showed no spaces. Fixed by applying
  `20261120` (the version on this branch, not main's older copy) and `20261121` to
  production. All checks pass and the 6 spaces show again.

## 1. Revoke the Supabase access token you pasted in chat (2 minutes)

You pasted a Supabase personal access token (it starts with `sbp_fc0b`) into the chat
on 25 Nov. It gives full access to every project in your account.

1. Open https://supabase.com/dashboard/account/tokens.
2. Delete that token.

It was never used or stored by me.

## 2. Push the overnight branch to GitHub

The work is in a git bundle in the project files:
`spacego-location/spacego-location.bundle`.

1. Download it from the Library to your PC's Downloads folder.
2. Send this to the session on your PC:

   > Fetch the branch from the bundle in my Downloads folder and push it. Don't merge and don't touch main:
   > `git fetch <Downloads>/spacego-location.bundle feature/spacego-location:feature/spacego-location`
   > then `git push -u origin feature/spacego-location`, then open a **draft** PR into `main`.

The bundle needs commit `b13f4a3`, which is already on GitHub. If you'd rather
not use the bundle, `spacego-location/patches/` has the same commits as
`.patch` files (`git am` them onto `b13f4a3`).

## 3. Check production (read-only, needs no approval)

PR #6 merged `feature/spacego-design-batch2` into `main` on 25 Nov at 16:33 IST.
If the Orun workflow is on, that deployed to production.

- Look at the latest run on `main` in GitHub Actions. Did it deploy production?
- Open the production site. If no spaces show, or booking fails, that is because
  production does not have the `20261120`/`20261121` migrations yet. Don't merge
  anything else into `main` until staging (step 4) is done.

## 4. Staging database (`itbpynkutqdrxspazaxr`, SpaceGo-Staging): needs your OK

Run each file in the Supabase SQL editor, in this order. **Check that the top bar says
SpaceGo-Staging first.** Each file is forward-only. None of them deletes or rewrites rows.
If a file fails, nothing in it is applied.

| Order | File (`supabase/migrations/`) | What it does | Check |
|---|---|---|---|
| 0 | (already applied by you) `20261120`, `20261121` | Auth and RLS hardening | Run the section 15 queries at the end of `20261121` |
| 1 | `20261126_spacego_geo_search.sql` | Enables PostGIS in `extensions`, adds the location search | Run `supabase/tests/geo_search_test.sql` |
| 2 | `20261127_spacego_listing_review.sql` | Listing review and audit | Run `supabase/tests/listing_review_test.sql` |
| 3 | `20261128_spacego_listing_photos.sql` | `listing-photos` bucket and upload rules | In Storage, the bucket exists and is public |
| 4 | `20261129_spacego_address_privacy.sql` | Hides street addresses until a booking is confirmed | Run `supabase/tests/address_privacy_test.sql` |
| 5 | `20261130_spacego_verification_checks.sql` | A badge needs recorded, dated checks; changes are audited | Run `supabase/tests/verification_checks_test.sql` |
| 6 | `20261201_spacego_reviews.sql` | Reviews after a confirmed stay, host responses, moderation | Run `supabase/tests/reviews_test.sql` |
| 7 | `20261202_spacego_booking_integrity.sql` | No duplicate requests; booking status history | Run `supabase/tests/booking_integrity_test.sql` |
| 8 | `20261203_spacego_listing_reports.sql` | Report a listing; admins resolve | Run `supabase/tests/listing_reports_test.sql` |
| 9 | `20261204_spacego_listing_documents.sql` | Private `listing-documents` bucket | In Storage, the bucket exists and is **not** public |

Each test file runs in a single transaction and is rolled back at the end. It
prints `... all checks passed` or stops with the failing check.

What changes for existing data:

- **After step 1:** if PostGIS is already enabled in a schema other than `extensions`, the
  file stops and changes nothing. Tell me and I'll adapt it.
- **After step 2:** listings that are live today stay live and count as approved.
  New listings and edits to key facts go through admin review.
- **After step 4:** every existing listing hides its street address publicly until
  its host picks "Everyone" in the listing form, which sends it to review.
- **After step 5:** listings that already show a badge keep it. The next time an admin
  edits their badge or checks, the admin has to record at least one dated check.
- **After step 7:** if staging already has two overlapping pending or confirmed
  bookings by the same guest for the same space, they stay. Only new ones are refused.
- **Not covered by these migrations:** the staging demo spaces keep whatever coordinates they have.
  Listings without a valid pin don't appear in location search.

Still to do after that (from 25 Nov):

- Create the test accounts.
- Give the demo spaces to the test owner.
- Run the booking and access tests against staging.

## 5. Production (`hxsstsfsqlzqhtfizbcq`): only after staging works, and only if you say so

`20261120` and `20261121` were applied on 26 Nov. Later, apply `20261126`
through `20261204` in the same order as on staging. Then run the seven test files and check both buckets.
