-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'SD_SLA_BREACH_PREDICTED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_PROBLEM_SUGGESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_KB_REVIEW';
ALTER TYPE "NotificationKind" ADD VALUE 'SD_REPORT_READY';
