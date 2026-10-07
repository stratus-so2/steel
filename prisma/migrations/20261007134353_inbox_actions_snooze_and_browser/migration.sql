-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'AI_ACTION_EXPIRING';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "snoozed_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification_delivery_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "browser_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_delivery_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_settings_user_id_workspace_id_key" ON "notification_delivery_settings"("user_id", "workspace_id");

-- AddForeignKey
ALTER TABLE "notification_delivery_settings" ADD CONSTRAINT "notification_delivery_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_settings" ADD CONSTRAINT "notification_delivery_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
