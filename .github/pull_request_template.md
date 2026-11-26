## What this changes

<!-- One or two sentences, and why. -->

## How it was checked

- [ ] `npm run lint` and `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run build`, then `npm run test:e2e`
- [ ] For a database change: the SQL tests in `supabase/tests/`, on a local copy or staging

## Database and deploys

Merging to `main` deploys the test site, then production.

- [ ] No migration, or a new forward-only file in `supabase/migrations/` with its run order in `supabase/README.md`
- [ ] Any migration this needs is already applied to staging, and to production if the code depends on it

## Secrets and personal data

- [ ] No secrets, tokens, passwords or personal data in code, docs, tests, logs or screenshots
- [ ] New settings are listed in `.env.example` with placeholder values only
