-- CreateEnum
CREATE TYPE "CrmAiAttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateTable
CREATE TABLE "crm_ai_attachments" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT,
    "kind" "CrmAiAttachmentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_ai_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_ai_attachments_conversation_id_idx" ON "crm_ai_attachments"("conversation_id");

-- CreateIndex
CREATE INDEX "crm_ai_attachments_message_id_idx" ON "crm_ai_attachments"("message_id");

-- AddForeignKey
ALTER TABLE "crm_ai_attachments" ADD CONSTRAINT "crm_ai_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "crm_ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_ai_attachments" ADD CONSTRAINT "crm_ai_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "crm_ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
