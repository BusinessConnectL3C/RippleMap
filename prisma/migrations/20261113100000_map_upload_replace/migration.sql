-- CreateEnum
CREATE TYPE "MapUploadMode" AS ENUM ('NEW', 'REPLACE');

-- AlterTable
ALTER TABLE "MapUpload" ADD COLUMN     "mode" "MapUploadMode" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "refreshRequestedAt" TIMESTAMP(3),
ADD COLUMN     "replacesUploadId" TEXT,
ADD COLUMN     "sourceArmedUntil" TIMESTAMP(3),
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "sourceToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MapUpload_sourceToken_key" ON "MapUpload"("sourceToken");

