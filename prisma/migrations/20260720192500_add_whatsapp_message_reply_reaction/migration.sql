-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "reacted_by_contact" BOOLEAN,
ADD COLUMN     "reaction_emoji" TEXT,
ADD COLUMN     "reply_to_message_id" TEXT;

-- CreateIndex
CREATE INDEX "whatsapp_messages_reply_to_message_id_idx" ON "whatsapp_messages"("reply_to_message_id");

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
