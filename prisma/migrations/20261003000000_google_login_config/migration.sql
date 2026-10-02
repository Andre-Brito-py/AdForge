-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "googleClientId" TEXT,
ADD COLUMN     "googleClientSecret" TEXT,
ADD COLUMN     "googleLoginEnabled" BOOLEAN NOT NULL DEFAULT true;
