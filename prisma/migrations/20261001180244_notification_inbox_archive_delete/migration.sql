-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_user_id_workspace_id_archived_at_deleted_at_idx" ON "notifications"("user_id", "workspace_id", "archived_at", "deleted_at");
