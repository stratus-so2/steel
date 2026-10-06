-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'CRM_LEAD_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_OPPORTUNITY_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_DEAL_CLOSED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_TASK_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_TASK_DUE';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_PROPOSAL_VIEWED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_PROPOSAL_ACCEPTED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_PROPOSAL_EXPIRED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_FORM_SUBMITTED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_CAMPAIGN_FINISHED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_WORKFLOW_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_WORKFLOW_WAITING';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_SOCIAL_POST_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE 'CRM_COMPETITOR_SYNC_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE 'MEMBER_JOINED';
ALTER TYPE "NotificationKind" ADD VALUE 'DATA_EXPORT_READY';
ALTER TYPE "NotificationKind" ADD VALUE 'TRIAL_ENDED';
ALTER TYPE "NotificationKind" ADD VALUE 'BILLING_PAYMENT_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE 'BILLING_SUBSCRIPTION_CANCELED';
ALTER TYPE "NotificationKind" ADD VALUE 'AI_QUOTA_WARNING';
ALTER TYPE "NotificationKind" ADD VALUE 'AI_QUOTA_EXCEEDED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" TEXT;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_preferences_workspace_id_kind_idx" ON "notification_preferences"("workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_workspace_id_kind_key" ON "notification_preferences"("user_id", "workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

