# Security policy

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately
on GitHub instead: open the repository's **Security** tab and choose
**Report a vulnerability**. (The button appears once the owner turns on
private vulnerability reporting under Settings → Code security.)

Say what you found, where (page, endpoint or file), how to reproduce it, and
what an attacker could do with it. Please don't read or change other people's
data, run load tests, or point automated scanners at the live sites.

You should hear back within a week. Fixes land on `main`, which deploys to the
test site first and then to production.

## Supported versions

Only the current `main` branch, as deployed, gets security fixes.

## How the app is protected

- **The database is the security boundary.** The browser talks to Supabase
  with the public publishable key, so every table in `public` has row-level
  security, client roles can write only what RLS and triggers allow, and every
  other write goes through a `SECURITY DEFINER` function with a fixed
  `search_path` that checks who is calling. Public listing data comes from
  sanitised views that hide exact addresses. See `supabase/README.md`.
- **Server-side auth checks.** `/dashboard`, `/owner` and `/admin` verify the
  session on the server with `getClaims()` and read the role from the
  `profiles` table, never from user metadata. Users can't change their own role.
- **Redirects** after sign-in accept same-site paths only, and redirect hosts
  are checked against `NEXT_PUBLIC_SITE_URL`.
- **HTTP security headers** on every page: HSTS, `nosniff`, no framing,
  a strict referrer policy, a permissions policy, and a Content-Security-Policy
  (see `src/lib/security-headers.ts`).
- **CI** runs lint, types, unit and browser tests and a gitleaks secret scan on
  every pull request; Dependabot proposes dependency and Actions updates.

## Handling secrets

- Never commit `.env*` files (other than `.env.example`), `.dev.vars`, Worker
  secrets, Supabase service-role or secret keys, database passwords, or
  personal access tokens. `.gitignore` already excludes the usual files.
- `NEXT_PUBLIC_*` values are built into the JavaScript every visitor
  downloads. Treat them as public, and never put a secret in one or in
  `intent.yaml`.
- Server-only keys (for example `MAPTILER_API_KEY`) are Worker secrets, set
  through Orun, never in the repository.
- If a secret is ever committed or pasted somewhere public, revoke and rotate
  it first, then remove it from the code. Deleting it from git history does not
  un-leak it.
