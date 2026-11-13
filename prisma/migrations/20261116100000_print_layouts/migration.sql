-- CreateTable
CREATE TABLE "OrgPrintLayout" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "feltLayoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgPrintLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintLayoutPreview" (
    "id" TEXT NOT NULL,
    "feltLayoutId" TEXT NOT NULL,
    "orientation" TEXT NOT NULL,
    "contentsKey" TEXT NOT NULL,
    "aspect" DOUBLE PRECISION NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintLayoutPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgPrintLayout_orgId_feltLayoutId_key" ON "OrgPrintLayout"("orgId", "feltLayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintLayoutPreview_feltLayoutId_orientation_key" ON "PrintLayoutPreview"("feltLayoutId", "orientation");

-- AddForeignKey
ALTER TABLE "OrgPrintLayout" ADD CONSTRAINT "OrgPrintLayout_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

