-- AlterTable
ALTER TABLE "CompanyKPI" ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "CompanyKPI_category_idx" ON "CompanyKPI"("category");
