# Supabase backend

SpaceGo uses Supabase when both public build-time values are present:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If either is missing, the app keeps using the localStorage demo data.

## 1. Apply the app-state migration

Run `migrations/20261119_spacego_app_state.sql` in the Supabase SQL editor.
It creates the `spacego_*` tables used by the client store and permissive demo
RLS policies for the anon key.

The older `20261108_init.sql` is the UUID/Supabase-Auth production schema. It
is intentionally separate and is not required for the demo backend.

## 2. Configure the build

Local development: copy `.env.example` to `.env.local` and fill both values.

Stage/prod: fill both values in `intent.yaml` under the component `env` block.
They are build-time values, not Worker runtime secrets, because Next inlines
`NEXT_PUBLIC_*` during `next build`.

## 3. Deploy

Merge the change to `main`. The Orun workflow rebuilds and deploys both
environments. On first load, empty remote tables are seeded from the current
local demo data, and subsequent writes are mirrored to Supabase.

## Current scope

Data collections are backed by Supabase. Authentication remains the existing
local demo auth until Supabase Auth is wired separately.
