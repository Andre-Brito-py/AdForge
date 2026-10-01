-- O default so era necessario para preencher linhas existentes; o Prisma gerencia @updatedAt
ALTER TABLE "GenerationJob" ALTER COLUMN "updatedAt" DROP DEFAULT;
