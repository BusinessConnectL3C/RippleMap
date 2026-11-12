-- CreateEnum
CREATE TYPE "MapUploadKind" AS ENUM ('FILE', 'URL');

-- CreateEnum
CREATE TYPE "MapUploadStatus" AS ENUM ('PENDING_UPLOAD', 'IMPORTING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "BillingStatus" ADD VALUE 'FREE';

-- CreateTable
CREATE TABLE "MapUpload" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "MapUploadKind" NOT NULL,
    "layerName" TEXT NOT NULL,
    "fileName" TEXT,
    "sourceUrl" TEXT,
    "sizeBytes" BIGINT,
    "s3Key" TEXT,
    "feltLayerId" TEXT,
    "status" "MapUploadStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "error" TEXT,
    "confirmedNoSensitiveData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MapUpload_mapId_idx" ON "MapUpload"("mapId");

-- CreateIndex
CREATE INDEX "MapUpload_orgId_idx" ON "MapUpload"("orgId");

-- AddForeignKey
ALTER TABLE "MapUpload" ADD CONSTRAINT "MapUpload_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "FeltMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

