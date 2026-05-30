-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ON_HOLD', 'DUE_TODAY', 'PARTS_NOT_AVAILABLE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "serviceStatus" "ServiceStatus";

-- CreateIndex
CREATE INDEX "Client_serviceStatus_idx" ON "Client"("serviceStatus");
