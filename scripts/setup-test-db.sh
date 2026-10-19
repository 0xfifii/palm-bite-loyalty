#!/usr/bin/env bash
# Creates a throwaway local PostgreSQL database, applies the Supabase shim and
# every migration in order, then loads the sample seed. Used by the database
# test suite. Requires a local PostgreSQL server (version 15 or newer).
#
# Usage: TEST_DATABASE_URL=postgres://user:pass@localhost:5432/postgres npm run db:test:setup
set -euo pipefail

ADMIN_URL="${TEST_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
DB_NAME="${TEST_DATABASE_NAME:-palm_bite_test}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB_NAME} with (force);"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "create database ${DB_NAME};"

TARGET_URL="${ADMIN_URL%/*}/${DB_NAME}"

psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/db/supabase-shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")"
  psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql"
echo "Test database ready: ${DB_NAME}"
