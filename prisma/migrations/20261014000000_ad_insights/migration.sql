-- CreateTable
CREATE TABLE "AdInsight" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "videoViews" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdInsight_creativeId_idx" ON "AdInsight"("creativeId");

-- CreateIndex
CREATE INDEX "AdInsight_workspaceId_syncedAt_idx" ON "AdInsight"("workspaceId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdInsight_source_sourceId_key" ON "AdInsight"("source", "sourceId");

-- AddForeignKey
ALTER TABLE "AdInsight" ADD CONSTRAINT "AdInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdInsight" ADD CONSTRAINT "AdInsight_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

