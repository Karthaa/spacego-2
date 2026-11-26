#!/usr/bin/env bash
# Local copy of the SpaceGo backend for end-to-end testing: Supabase Auth
# (GoTrue), PostgREST and Storage in Docker, against a local Postgres 16 with
# PostGIS, behind a small proxy on http://localhost:54321.
#
# Nothing here touches staging or production. Secrets are generated per run
# into $STATE (default /tmp/spacego-local) and never written to the repo.
#
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres ./tooling/local-supabase/up.sh
#   then: npm run dev with the values printed at the end.
set -euo pipefail
cd "$(dirname "$0")/../.."
STATE="${STATE:-/tmp/spacego-local}"
DB="${DB:-spacego_local}"
: "${PGHOST:=127.0.0.1}" "${PGPORT:=5432}" "${PGUSER:=postgres}"
export PGHOST PGPORT PGUSER
mkdir -p "$STATE/storage"
chmod 700 "$STATE"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

[ -f "$STATE/jwt_secret" ] || openssl rand -hex 32 > "$STATE/jwt_secret"
SECRET="$(cat "$STATE/jwt_secret")"
node -e '
const c=require("crypto"),fs=require("fs"),[s,dir]=process.argv.slice(1);
const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const mk=r=>{const h=b({alg:"HS256",typ:"JWT"}),p=b({role:r,iss:"supabase",iat:1764000000,exp:2079600000});return h+"."+p+"."+c.createHmac("sha256",s).update(h+"."+p).digest("base64url")};
fs.writeFileSync(dir+"/anon_key",mk("anon"));fs.writeFileSync(dir+"/service_key",mk("service_role"));' "$SECRET" "$STATE"

"${PSQL[@]}" -d postgres <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin LOGIN CREATEROLE NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin LOGIN CREATEROLE NOINHERIT; END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO supabase_storage_admin;
SQL
if ! "${PSQL[@]}" -d postgres -tAc "select 1 from pg_database where datname='$DB'" | grep -q 1; then
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB"
  "${PSQL[@]}" -d postgres -c "GRANT ALL ON DATABASE $DB TO supabase_storage_admin"
  "${PSQL[@]}" -d "$DB" <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth;
ALTER ROLE supabase_storage_admin SET search_path = storage;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SQL
fi

DBURL_HOST="postgres://%s@${PGHOST}:${PGPORT}/${DB}"
docker rm -f sg-gotrue sg-postgrest sg-storage >/dev/null 2>&1 || true
docker run -d --name sg-gotrue --network host \
  -e GOTRUE_API_HOST=127.0.0.1 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL="$(printf "$DBURL_HOST" supabase_auth_admin)?sslmode=disable" \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" \
  -e GOTRUE_JWT_SECRET="$SECRET" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
  -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true \
  -e GOTRUE_SMTP_ADMIN_EMAIL=admin@example.invalid supabase/gotrue:v2.177.0 >/dev/null
echo "Waiting for Auth migrations..."; sleep 8

# Supabase grants clients table privileges on storage (RLS does the limiting).
"${PSQL[@]}" -d "$DB" -c "SELECT 1" >/dev/null
for f in supabase/migrations/*.sql; do
  case "$f" in *listing_photos*) continue ;; esac
  echo "Applying $f"; "${PSQL[@]}" -d "$DB" -f "$f"
done

docker run -d --name sg-postgrest --network host \
  -e PGRST_DB_URI="$(printf "$DBURL_HOST" authenticator)" -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$SECRET" -e PGRST_SERVER_PORT=3300 -e PGRST_SERVER_HOST=127.0.0.1 \
  -e PGRST_DB_EXTRA_SEARCH_PATH=public,extensions postgrest/postgrest:v12.2.12 >/dev/null
docker run -d --name sg-storage --network host -v "$STATE/storage:/var/lib/storage" \
  -e ANON_KEY="$(cat "$STATE/anon_key")" -e SERVICE_KEY="$(cat "$STATE/service_key")" -e POSTGREST_URL=http://127.0.0.1:3300 \
  -e PGRST_JWT_SECRET="$SECRET" -e AUTH_JWT_SECRET="$SECRET" -e DATABASE_URL="$(printf "$DBURL_HOST" supabase_storage_admin)" \
  -e FILE_SIZE_LIMIT=52428800 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage \
  -e TENANT_ID=stub -e REGION=stub -e GLOBAL_S3_BUCKET=stub -e ENABLE_IMAGE_TRANSFORMATION=false \
  -e SERVER_PORT=5000 -e PORT=5000 -e SERVER_HOST=127.0.0.1 -e HOST=127.0.0.1 supabase/storage-api:v1.25.7 >/dev/null
echo "Waiting for Storage migrations..."; sleep 12
"${PSQL[@]}" -d "$DB" -c "GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role" \
  -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role"
"${PSQL[@]}" -d "$DB" -f supabase/migrations/20261128_spacego_listing_photos.sql

pkill -f "tooling/local-supabase/proxy.mjs" 2>/dev/null || true
nohup node tooling/local-supabase/proxy.mjs > "$STATE/proxy.log" 2>&1 &
sleep 1
echo
echo "Local backend is up on http://localhost:54321"
echo "Run the app against it with:"
echo "  NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\$(cat $STATE/anon_key) npm run dev"
