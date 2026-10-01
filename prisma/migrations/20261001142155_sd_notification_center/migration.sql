-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_CREATED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_MENTIONED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_PHASE_CHANGED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_RESOLVED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_REOPENED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_APPROVAL_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TASK_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_TICKET_CSAT';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_DIGEST';

-- AlterTable
ALTER TABLE "sd_ticket_messages" ADD COLUMN     "mentioned_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
