/*
  Warnings:

  - A unique constraint covering the columns `[shareSlug]` on the table `Story` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `narrative` to the `Story` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Story" ADD COLUMN     "error" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "narrative" TEXT NOT NULL,
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "shareSlug" TEXT,
ADD COLUMN     "status" "public"."StoryStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "beatsJson" SET DEFAULT '[]',
ALTER COLUMN "panelMap" SET DEFAULT '[]';

-- CreateIndex
CREATE UNIQUE INDEX "Story_shareSlug_key" ON "public"."Story"("shareSlug");

-- CreateIndex
CREATE INDEX "Story_status_createdAt_idx" ON "public"."Story"("status", "createdAt");
