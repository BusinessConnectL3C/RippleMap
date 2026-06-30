-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('S3', 'ARCGIS');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "mediaSource" "MediaSource";
