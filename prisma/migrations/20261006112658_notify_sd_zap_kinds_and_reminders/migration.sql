-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'SD_APPROVAL_CANCELED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_APPROVAL_EXPIRED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TASK_DUE';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_ONCALL_SHIFT';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_CONTRACT_FRANCHISE';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_KB_COMMENT';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_MONITOR_ALERT';
ALTER TYPE "NotificationKind" ADD VALUE 'WHATSAPP_CONVERSATION_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'WHATSAPP_AI_HANDOFF';
ALTER TYPE "NotificationKind" ADD VALUE 'WHATSAPP_CONNECTION_LOST';
ALTER TYPE "NotificationKind" ADD VALUE 'WHATSAPP_BROADCAST_FINISHED';
ALTER TYPE "NotificationKind" ADD VALUE 'WHATSAPP_TEMPLATE_REJECTED';

-- AlterTable
ALTER TABLE "sd_contract_periods" ADD COLUMN     "franchise_warned_at" TIMESTAMP(3),
ADD COLUMN     "overage_warned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sd_ticket_tasks" ADD COLUMN     "due_soon_notified_at" TIMESTAMP(3),
ADD COLUMN     "overdue_notified_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "sd_ticket_tasks_status_due_date_idx" ON "sd_ticket_tasks"("status", "due_date");
