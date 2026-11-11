-- CreateEnum
CREATE TYPE "FeltMapKind" AS ENUM ('MAP', 'DASHBOARD', 'SURVEY');

-- CreateEnum
CREATE TYPE "MapVisibility" AS ENUM ('RESTRICTED', 'ALL_MEMBERS');

-- CreateEnum
CREATE TYPE "FeltAccess" AS ENUM ('EDIT', 'CONTRIBUTE');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "arcgisEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feltProjectId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "feltAccess" "FeltAccess",
ADD COLUMN     "feltEmail" TEXT,
ADD COLUMN     "feltSeat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feltSeatSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FeltMap" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "feltMapId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "FeltMapKind" NOT NULL DEFAULT 'MAP',
    "visibility" "MapVisibility" NOT NULL DEFAULT 'RESTRICTED',
    "thumbnailKey" TEXT,
    "webhookSecretEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeltMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeltMapGrant" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeltMapGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeltMap_feltMapId_key" ON "FeltMap"("feltMapId");

-- CreateIndex
CREATE INDEX "FeltMap_orgId_idx" ON "FeltMap"("orgId");

-- CreateIndex
CREATE INDEX "FeltMapGrant_userId_idx" ON "FeltMapGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FeltMapGrant_mapId_userId_key" ON "FeltMapGrant"("mapId", "userId");

-- AddForeignKey
ALTER TABLE "FeltMap" ADD CONSTRAINT "FeltMap_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeltMapGrant" ADD CONSTRAINT "FeltMapGrant_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "FeltMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeltMapGrant" ADD CONSTRAINT "FeltMapGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Orgs that already have an ArcGIS group are existing Esri customers: keep
-- ArcGIS features on for them. New orgs default to Felt-only.
UPDATE "Organization" SET "arcgisEnabled" = true WHERE "arcgisGroupId" IS NOT NULL;
