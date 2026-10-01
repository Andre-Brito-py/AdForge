-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "refreshToken" TEXT;

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "optionsJson" TEXT;

-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "mercadoLivreAppId" TEXT,
ADD COLUMN     "mercadoLivreSecret" TEXT,
ADD COLUMN     "nuvemshopAppId" TEXT,
ADD COLUMN     "nuvemshopSecret" TEXT;
