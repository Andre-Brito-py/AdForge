-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "briefing" TEXT,
ADD COLUMN     "videoDuration" INTEGER NOT NULL DEFAULT 5;
