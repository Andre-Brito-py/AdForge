-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "resendKey" TEXT,
ADD COLUMN     "settingsJson" TEXT,
ADD COLUMN     "signupsEnabled" BOOLEAN NOT NULL DEFAULT true;
