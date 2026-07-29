-- CreateEnum
CREATE TYPE "WhatsAppAiKnowledgeDocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "whatsapp_ai_knowledge_documents" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "WhatsAppAiKnowledgeDocumentStatus" NOT NULL DEFAULT 'PROCESSING',
    "extracted_text" TEXT,
    "error_message" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_ai_knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_ai_knowledge_documents_workspace_id_status_idx" ON "whatsapp_ai_knowledge_documents"("workspace_id", "status");

-- AddForeignKey
ALTER TABLE "whatsapp_ai_knowledge_documents" ADD CONSTRAINT "whatsapp_ai_knowledge_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_ai_knowledge_documents" ADD CONSTRAINT "whatsapp_ai_knowledge_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
