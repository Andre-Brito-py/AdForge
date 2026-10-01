-- Ofertas de teste gratis passam a ser opt-in pelo super admin
-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "freePlanVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeTrialEnabled" BOOLEAN NOT NULL DEFAULT false;
