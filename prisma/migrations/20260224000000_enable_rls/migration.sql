-- Enable Row Level Security on all public tables.
--
-- The app accesses the database exclusively via Prisma using the service_role
-- (or postgres superuser), both of which bypass RLS in Supabase. No policies
-- are needed — this simply closes PostgREST/anon access as a defence-in-depth
-- measure and resolves the Supabase security advisor alert.

ALTER TABLE "public"."User"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Room"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Photo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Story" ENABLE ROW LEVEL SECURITY;
