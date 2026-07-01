-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- AlterTable
ALTER TABLE "OrgInvite" ADD COLUMN "status" "InviteStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "OrgInvite" ADD COLUMN "invitedById" TEXT;
ALTER TABLE "OrgInvite" RENAME COLUMN "usedAt" TO "acceptedAt";

-- Backfill status for invites already accepted under the pre-status schema
UPDATE "OrgInvite" SET "status" = 'ACCEPTED' WHERE "acceptedAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "OrgInvite_orgId_idx" ON "OrgInvite"("orgId");

-- AddForeignKey
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
