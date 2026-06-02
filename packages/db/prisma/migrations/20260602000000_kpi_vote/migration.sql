-- CreateTable
CREATE TABLE "KpiVote" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiVote_kpiId_idx" ON "KpiVote"("kpiId");

-- CreateIndex
CREATE INDEX "KpiVote_userId_idx" ON "KpiVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiVote_kpiId_userId_key" ON "KpiVote"("kpiId", "userId");

-- AddForeignKey
ALTER TABLE "KpiVote" ADD CONSTRAINT "KpiVote_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "CompanyKPI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiVote" ADD CONSTRAINT "KpiVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
