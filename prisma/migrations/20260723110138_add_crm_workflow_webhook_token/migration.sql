-- AlterTable
ALTER TABLE "crm_workflows" ADD COLUMN "webhook_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "crm_workflows_webhook_token_key" ON "crm_workflows"("webhook_token");
