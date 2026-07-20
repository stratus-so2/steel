-- AlterTable
ALTER TABLE "whatsapp_connections" ADD COLUMN     "webhook_secret" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_webhook_secret_key" ON "whatsapp_connections"("webhook_secret");
