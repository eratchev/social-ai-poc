-- DropForeignKey
ALTER TABLE "public"."Photo" DROP CONSTRAINT "Photo_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Photo" DROP CONSTRAINT "Photo_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Room" DROP CONSTRAINT "Room_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."Story" DROP CONSTRAINT "Story_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Story" DROP CONSTRAINT "Story_roomId_fkey";

-- AlterTable
ALTER TABLE "public"."Photo" ADD COLUMN     "bytes" INTEGER,
ADD COLUMN     "folder" TEXT,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "width" INTEGER;

-- CreateIndex
CREATE INDEX "Photo_roomId_idx" ON "public"."Photo"("roomId");

-- CreateIndex
CREATE INDEX "Photo_ownerId_idx" ON "public"."Photo"("ownerId");

-- CreateIndex
CREATE INDEX "Photo_publicId_idx" ON "public"."Photo"("publicId");

-- CreateIndex
CREATE INDEX "Photo_createdAt_idx" ON "public"."Photo"("createdAt");

-- CreateIndex
CREATE INDEX "Room_createdBy_idx" ON "public"."Room"("createdBy");

-- CreateIndex
CREATE INDEX "Room_createdAt_idx" ON "public"."Room"("createdAt");

-- CreateIndex
CREATE INDEX "Story_roomId_idx" ON "public"."Story"("roomId");

-- CreateIndex
CREATE INDEX "Story_ownerId_idx" ON "public"."Story"("ownerId");

-- CreateIndex
CREATE INDEX "Story_createdAt_idx" ON "public"."Story"("createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Photo" ADD CONSTRAINT "Photo_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Photo" ADD CONSTRAINT "Photo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Story" ADD CONSTRAINT "Story_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Story" ADD CONSTRAINT "Story_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
