-- AlterTable
ALTER TABLE "sd_ai_conversations" ADD COLUMN     "whatsapp_conversation_id" TEXT;

-- CreateIndex
CREATE INDEX "sd_ai_conversations_whatsapp_conversation_id_idx" ON "sd_ai_conversations"("whatsapp_conversation_id");
