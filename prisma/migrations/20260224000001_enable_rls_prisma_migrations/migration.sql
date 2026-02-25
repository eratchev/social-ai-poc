-- Enable RLS on the Prisma migrations tracking table.
-- Prisma itself connects as service_role/postgres which bypasses RLS,
-- so this has no functional impact but resolves the Supabase security alert.

ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
