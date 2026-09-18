-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('WHATSAPP_NEGATIVE_SENTIMENT');

-- AlterEnum
ALTER TYPE "WhatsAppConversationEventKind" ADD VALUE 'SENTIMENT_ALERT';

-- AlterEnum
ALTER TYPE "WhatsAppConversationEventSource" ADD VALUE 'SENTIMENT';

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "sentiment_alerted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_settings" ADD COLUMN     "sentiment_alert_assign_to_id" TEXT,
ADD COLUMN     "sentiment_alert_cooldown_hours" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "sentiment_alert_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sentiment_alert_notify_email" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentiment_alert_notify_in_app" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sentiment_alert_recipient_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sentiment_alert_threshold" DOUBLE PRECISION NOT NULL DEFAULT -0.3;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_workspace_id_created_at_idx" ON "notifications"("user_id", "workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_workspace_id_read_at_idx" ON "notifications"("user_id", "workspace_id", "read_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

