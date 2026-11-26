# Morning approvals (26 Nov 2026)

These are the things that are waiting on you, in order. Nothing on this list
has been done yet. Each step is safe to stop after.

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

| Order | File | What it does | Check |
|---|---|---|---|
| 0 | (already applied by you) `20261120`, `20261121` | Auth and RLS hardening | Run the section 15 queries at the end of `20261121` |
| 1 | `supabase/migrations/20261126_spacego_geo_search.sql` | Enables PostGIS in `extensions`, adds the location search | Run `supabase/tests/geo_search_test.sql` |
| 2 | `supabase/migrations/20261127_spacego_listing_review.sql` | Listing review and audit | Run `supabase/tests/listing_review_test.sql` |
| 3 | `supabase/migrations/20261128_spacego_listing_photos.sql` | `listing-photos` bucket and upload rules | In Storage, the bucket exists |
| 4 | `supabase/migrations/20261129_spacego_address_privacy.sql` | Hides street addresses until a booking is confirmed | Run `supabase/tests/address_privacy_test.sql` |

Each test file runs in a single transaction and is rolled back at the end. It
prints `... all checks passed` or stops with the failing check.

What changes for existing data:

- **After step 1:** if PostGIS is already enabled in a schema other than `extensions`, the
  file stops and changes nothing. Tell me and I'll adapt it.
- **After step 2:** listings that are live today stay live and count as approved.
  New listings and edits to key facts go through admin review.
- **After step 4:** every existing listing hides its street address publicly until
  its host picks "Everyone" in the listing form, which sends it to review.
- **Not covered by these migrations:** the staging demo spaces keep whatever coordinates they have.
  Listings without a valid pin don't appear in location search.

Still to do after that (from 25 Nov):

- Create the test accounts.
- Give the demo spaces to the test owner.
- Run the booking and access tests against staging.

## 5. Production (`hxsstsfsqlzqhtfizbcq`): only after staging works, and only if you say so

Apply the same files in the same order: `20261120`, `20261121`, `20261126`,
`20261127`, `20261128`, then `20261129`. Then run the three test files. Nothing
has been applied to production by me.
