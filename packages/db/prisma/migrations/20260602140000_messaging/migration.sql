-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('RESEND', 'SMTP');

-- CreateEnum
CREATE TYPE "BulkRecipientState" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "MessagingSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'singleton',
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappPhoneNumberId" TEXT,
    "whatsappAccessToken" TEXT,
    "whatsappBusinessNumber" TEXT,
    "whatsappDisplayName" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailProvider" "EmailProvider",
    "emailFromName" TEXT,
    "emailFromAddress" TEXT,
    "emailApiKey" TEXT,
    "emailSmtpHost" TEXT,
    "emailSmtpPort" INTEGER,
    "emailSmtpUser" TEXT,
    "emailSmtpPassword" TEXT,
    "emailSmtpSecure" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingSettings_key_key" ON "MessagingSettings"("key");

-- CreateTable
CREATE TABLE "BulkMessage" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkMessage_senderId_idx" ON "BulkMessage"("senderId");

-- CreateIndex
CREATE INDEX "BulkMessage_createdAt_idx" ON "BulkMessage"("createdAt");

-- CreateTable
CREATE TABLE "BulkMessageRecipient" (
    "id" TEXT NOT NULL,
    "bulkMessageId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "state" "BulkRecipientState" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkMessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkMessageRecipient_bulkMessageId_idx" ON "BulkMessageRecipient"("bulkMessageId");

-- CreateIndex
CREATE INDEX "BulkMessageRecipient_clientId_idx" ON "BulkMessageRecipient"("clientId");

-- AddForeignKey
ALTER TABLE "MessagingSettings" ADD CONSTRAINT "MessagingSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkMessage" ADD CONSTRAINT "BulkMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkMessageRecipient" ADD CONSTRAINT "BulkMessageRecipient_bulkMessageId_fkey" FOREIGN KEY ("bulkMessageId") REFERENCES "BulkMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkMessageRecipient" ADD CONSTRAINT "BulkMessageRecipient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
