#!/usr/bin/env bash
set -euo pipefail

# --- Config (tweak as needed) ---
SCHEMA_PATH="${SCHEMA_PATH:-prisma/schema.prisma}"
ENV_FILE="${1:-.env.production}"         # default to .env.production; pass a different path as first arg
FORCE="${FORCE:-false}"                  # set FORCE=true to skip confirmation
BACKUP="${BACKUP:-true}"                 # set BACKUP=false to skip pg_dump backup
SEED="${SEED:-false}"                    # set SEED=true to run `prisma db seed` after migrate
TS=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./db_backups}"
# ---------------------------------

echo "==> Using env file: ${ENV_FILE}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Env file not found: $ENV_FILE"
  echo "   Pass a different file: scripts/migrate-supabase.sh .env.prod"
  exit 1
fi

# Export only lines that look like KEY=VALUE (ignore comments)
# shellcheck disable=SC2046
export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | xargs)

# Required: DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set in $ENV_FILE"
  exit 1
fi

# Safety check: encourage using DIRECT (5432) Supabase URL for migrations
if [[ "$DATABASE_URL" != *":5432/"* ]]; then
  echo "⚠️  DATABASE_URL does not appear to be a direct Postgres URL on port 5432."
  echo "    For Prisma migrations, use the DIRECT connection string (not the pooled/pgbouncer one)."
  echo "    Continue anyway? (y/N)"
  if [[ "${FORCE}" != "true" ]]; then
    read -r ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || exit 1
  fi
fi

# Final confirmation
if [[ "${FORCE}" != "true" ]]; then
  echo "You are about to APPLY Prisma migrations to:"
  echo "  $DATABASE_URL"
  echo "Proceed? (type 'apply' to continue):"
  read -r confirm
  [[ "$confirm" == "apply" ]] || { echo "Aborted."; exit 1; }
fi

# Optional backup (requires pg_dump in PATH)
if [[ "${BACKUP}" == "true" ]]; then
  if command -v pg_dump >/dev/null 2>&1; then
    mkdir -p "${BACKUP_DIR}"
    BK_FILE="${BACKUP_DIR}/supabase-${TS}.dump"
    echo "==> Creating backup with pg_dump (${BK_FILE}) ..."
    # -Fc = custom format (compressed, parallelizable restore)
    if pg_dump -Fc "${DATABASE_URL}" -f "${BK_FILE}"; then
      echo "✅ Backup saved to ${BK_FILE}"
    else
      echo "⚠️  Backup failed (continuing). You may want to investigate pg_dump connectivity."
    fi
  else
    echo "ℹ️  pg_dump not found; skipping backup. Install via 'brew install libpq && brew link --force libpq' on macOS."
  fi
fi

echo "==> Validating Prisma schema ..."
npx prisma validate --schema "${SCHEMA_PATH}"

echo "==> Applying migrations (prisma migrate deploy) ..."
npx prisma migrate deploy --schema "${SCHEMA_PATH}"

echo "==> Generating Prisma client ..."
npx prisma generate --schema "${SCHEMA_PATH}"

if [[ "${SEED}" == "true" ]]; then
  echo "==> Running seed (prisma db seed) ..."
  npx prisma db seed --schema "${SCHEMA_PATH}"
fi

echo "==> Migration status:"
npx prisma migrate status --schema "${SCHEMA_PATH}"

echo "🎉 Done."