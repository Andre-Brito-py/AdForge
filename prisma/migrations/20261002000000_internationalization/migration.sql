-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'pt-BR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'pt';
