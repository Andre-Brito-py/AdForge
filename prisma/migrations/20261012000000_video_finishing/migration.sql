-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "captions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "endCard" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Creative" ADD COLUMN     "captionsJson" TEXT,
ADD COLUMN     "formatsJson" TEXT,
ADD COLUMN     "masterUrl" TEXT;

