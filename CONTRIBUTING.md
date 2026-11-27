# Contributing to SpaceGo

## Set up

1. Node 22 (`.nvmrc`) and npm.
2. `npm ci`
3. `npm run dev`. Without `.env.local` the app runs in demo mode with sample
   data. To work against a real backend, copy `.env.example` to `.env.local`
   and use the staging project or your own, never production.

Your editor should pick up `.editorconfig` (UTF-8, LF, two spaces).
`.gitattributes` keeps line endings LF on every machine, Windows included.

## Make a change

1. Branch from `main`: `feature/…`, `fix/…` or `chore/…`.
2. Keep each pull request to one purpose, and fill in the template's
   checklist.
3. Before you push, run what CI runs:

   ```bash
   npm run lint
   npm run typecheck
   npm run test:unit
   npm run build && npm run test:e2e
   ```

4. Add or update tests with the change: unit tests in `tests/unit/` for plain
   logic, Playwright tests in `e2e/` for pages, SQL tests in `supabase/tests/`
   for database rules.
5. A pull request needs the **CI** checks and Orun's verify checks green.

**Merging to `main` deploys the test site and then production.** Merge only
when the change is ready for real visitors, and after any migration it needs
has been applied.

## Database changes

- **Forward-only.** Add a new file to `supabase/migrations/` named with the
  next date prefix, for example `20261208_spacego_<what>.sql`. Never edit a
  migration that has been applied anywhere.
- Make it **one transaction** (`BEGIN; … COMMIT;`) and safe to re-run where
  possible. Check for what it depends on and fail with a clear message.
- **Never weaken row-level security.** New tables get RLS on and no client
  write grants; writes go through a `SECURITY DEFINER` function with
  `SET search_path = ''` that checks who is calling.
- Add a test in `supabase/tests/` that runs in a transaction and ends with
  `ROLLBACK`, so it is safe to run on staging.
- Apply it to **staging first**, run the tests there, then production. Note
  the order in `supabase/README.md`.

## Demo data

Demo listings belong on the test site only (`supabase/demo/`). Each one is
labelled as a demo, and none gets a verification badge, rating or review.
Never run the demo scripts on production; they refuse to.

## Secrets and personal data

- Never commit secrets: `.env*` files other than `.env.example`, `.dev.vars`,
  service-role or secret keys, database passwords, access tokens. CI scans
  every commit with gitleaks.
- `NEXT_PUBLIC_*` values are visible to every visitor. Don't put anything
  secret in them or in `intent.yaml`.
- Keep real people's names, emails and phone numbers out of code, fixtures,
  docs and screenshots. Use `example.com` addresses in sample data.
- See [SECURITY.md](SECURITY.md) for reporting a vulnerability and for what
  to do if a secret leaks.

## Style

- TypeScript in strict mode; ESLint with the Next.js rules.
- Use the design system's semantic tokens (`docs/DESIGN_SYSTEM.md`), never raw
  colours, so light and dark mode keep working.
- Pages must stay accessible: the Playwright suite runs axe on the main pages
  in both themes.
