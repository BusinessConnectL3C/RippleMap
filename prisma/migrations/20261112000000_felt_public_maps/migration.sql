-- AlterEnum
ALTER TYPE "MapVisibility" ADD VALUE 'PUBLIC';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "feltSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FeltMap" ADD COLUMN     "madePublicInFelt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicSince" TIMESTAMP(3);

