-- CreateTable
CREATE TABLE "ImageRightsRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "declarationVersion" TEXT NOT NULL,
    "declarationText" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "imageUrls" TEXT NOT NULL,
    "imageHashes" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ImageRightsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageRightsRecord_createdAt_idx" ON "ImageRightsRecord"("createdAt");

-- CreateIndex
CREATE INDEX "ImageRightsRecord_userEmail_idx" ON "ImageRightsRecord"("userEmail");

-- CreateIndex
CREATE INDEX "ImageRightsRecord_campaignId_idx" ON "ImageRightsRecord"("campaignId");
