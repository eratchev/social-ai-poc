-- Enable RLS on Heartbeat to close PostgREST/anon access.
-- The app uses service_role (via Prisma) which bypasses RLS, so no policies needed.
ALTER TABLE "public"."Heartbeat" ENABLE ROW LEVEL SECURITY;
