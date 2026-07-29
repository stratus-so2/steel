-- AlterTable
ALTER TABLE "whatsapp_broadcast_lists" ADD COLUMN     "template_id" TEXT;

-- AlterTable
ALTER TABLE "whatsapp_broadcast_recipients" ADD COLUMN     "scheduled_at" TIMESTAMP(3),
ADD COLUMN     "variable_values" JSONB;

-- CreateIndex
CREATE INDEX "whatsapp_broadcast_lists_template_id_idx" ON "whatsapp_broadcast_lists"("template_id");

-- CreateIndex
CREATE INDEX "whatsapp_broadcast_recipients_status_scheduled_at_idx" ON "whatsapp_broadcast_recipients"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "whatsapp_broadcast_lists" ADD CONSTRAINT "whatsapp_broadcast_lists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
