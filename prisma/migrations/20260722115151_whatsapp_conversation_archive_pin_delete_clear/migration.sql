-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "cleared_at" TIMESTAMP(3),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "pinned_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "whatsapp_conversations_workspace_id_deleted_at_archived_at__idx" ON "whatsapp_conversations"("workspace_id", "deleted_at", "archived_at", "pinned_at");
