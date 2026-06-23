-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('NONPROFIT', 'CORPORATE');

-- AlterEnum: replace CLIENT/ADMIN with OWNER/ADMIN/MEMBER/BC_STAFF
-- Step 1: add new values
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MEMBER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BC_STAFF';

-- CreateTable: Organization
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'NONPROFIT',
    "arcgisGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Add orgId to User (nullable first, then backfill, then set NOT NULL)
ALTER TABLE "User" ADD COLUMN "orgId" TEXT;

-- Migrate existing users: create one org per user, using orgName or name
INSERT INTO "Organization" ("id", "name", "type", "arcgisGroupId", "createdAt", "updatedAt")
SELECT
    'org_' || "id",
    COALESCE("orgName", "name"),
    'NONPROFIT'::"OrgType",
    "arcgisGroupId",
    "createdAt",
    "updatedAt"
FROM "User";

UPDATE "User" SET "orgId" = 'org_' || "id";

-- Now enforce NOT NULL
ALTER TABLE "User" ALTER COLUMN "orgId" SET NOT NULL;

-- Migrate OnboardingState: add orgId, backfill, enforce NOT NULL, drop userId
ALTER TABLE "OnboardingState" ADD COLUMN "orgId" TEXT;
UPDATE "OnboardingState" SET "orgId" = 'org_' || "userId";
ALTER TABLE "OnboardingState" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "OnboardingState" DROP CONSTRAINT IF EXISTS "OnboardingState_userId_key";
ALTER TABLE "OnboardingState" DROP COLUMN "userId";
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_orgId_key" UNIQUE ("orgId");

-- Migrate SupportTicket: add orgId, backfill, enforce NOT NULL, drop userId
ALTER TABLE "SupportTicket" ADD COLUMN "orgId" TEXT;
UPDATE "SupportTicket" SET "orgId" = 'org_' || "userId";
ALTER TABLE "SupportTicket" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "SupportTicket" DROP COLUMN "userId";

-- Drop old User columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "orgName";
ALTER TABLE "User" DROP COLUMN IF EXISTS "arcgisGroupId";

-- Migrate ArcGISAccountLink: drop isPrimary, make userId unique, drop old unique index
ALTER TABLE "ArcGISAccountLink" DROP COLUMN IF EXISTS "isPrimary";
ALTER TABLE "ArcGISAccountLink" DROP CONSTRAINT IF EXISTS "ArcGISAccountLink_userId_orgId_key";
ALTER TABLE "ArcGISAccountLink" ADD CONSTRAINT "ArcGISAccountLink_userId_key" UNIQUE ("userId");

-- Drop SalesforceLink table
DROP TABLE IF EXISTS "SalesforceLink";

-- AddForeignKey: User -> Organization
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: OnboardingState -> Organization
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SupportTicket -> Organization
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 2: remove old Role values (CLIENT becomes MEMBER; old ADMIN becomes BC_STAFF)
-- Postgres doesn't support DROP VALUE from enums — update data first, then rename via a new type
UPDATE "User" SET "role" = 'MEMBER' WHERE "role" = 'CLIENT';
UPDATE "User" SET "role" = 'BC_STAFF' WHERE "role" = 'ADMIN';

-- Mark first user per org as OWNER
UPDATE "User" u
SET "role" = 'OWNER'
WHERE "id" = (
    SELECT "id" FROM "User" WHERE "orgId" = u."orgId" ORDER BY "createdAt" ASC LIMIT 1
);
