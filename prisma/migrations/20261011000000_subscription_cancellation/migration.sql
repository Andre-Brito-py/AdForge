-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "cancellationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cancellationFeeInvoiceId" TEXT,
ADD COLUMN     "cancellationFeeStatus" TEXT;

