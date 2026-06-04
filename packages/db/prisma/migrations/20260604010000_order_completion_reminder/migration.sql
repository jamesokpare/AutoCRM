-- CreateTable
CREATE TABLE "OrderCompletionReminder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "expectedDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCompletionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderCompletionReminder_orderId_daysBefore_expectedDate_userId_key" ON "OrderCompletionReminder"("orderId", "daysBefore", "expectedDate", "userId");

-- CreateIndex
CREATE INDEX "OrderCompletionReminder_orderId_idx" ON "OrderCompletionReminder"("orderId");

-- CreateIndex
CREATE INDEX "OrderCompletionReminder_userId_idx" ON "OrderCompletionReminder"("userId");

-- AddForeignKey
ALTER TABLE "OrderCompletionReminder" ADD CONSTRAINT "OrderCompletionReminder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCompletionReminder" ADD CONSTRAINT "OrderCompletionReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
