-- CreateEnum
CREATE TYPE "workspace_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETING');

-- CreateEnum
CREATE TYPE "admin_operation_kind" AS ENUM ('WORKSPACE_DELETE', 'WORKSPACE_RESTORE');

-- CreateEnum
CREATE TYPE "admin_operation_status" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "backups" DROP CONSTRAINT "backups_workspace_id_fkey";

-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "offsite_copied_at" TIMESTAMP(3),
ADD COLUMN     "offsite_key" TEXT,
ADD COLUMN     "triggered_by_id" TEXT,
ADD COLUMN     "workspace_slug" TEXT;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "status" "workspace_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspended_by_id" TEXT,
ADD COLUMN     "suspended_reason" TEXT;

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "target_label" TEXT,
    "reason" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_operations" (
    "id" TEXT NOT NULL,
    "kind" "admin_operation_kind" NOT NULL,
    "status" "admin_operation_status" NOT NULL DEFAULT 'QUEUED',
    "step" TEXT NOT NULL DEFAULT 'queued',
    "workspace_id" TEXT NOT NULL,
    "workspace_slug" TEXT NOT NULL,
    "workspace_name" TEXT NOT NULL,
    "backup_id" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "requested_by_email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "error" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "admin_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_created_at_idx" ON "admin_audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_operations_workspace_id_created_at_idx" ON "admin_operations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_operations_status_idx" ON "admin_operations"("status");

-- CreateIndex
CREATE INDEX "admin_operations_created_at_idx" ON "admin_operations"("created_at");

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");

-- Backfill: slug dos backups de workspace já existentes (o painel lista por
-- slug mesmo depois que o workspace deixa de existir).
UPDATE "backups" b
SET "workspace_slug" = w."slug"
FROM "workspaces" w
WHERE b."workspace_id" = w."id" AND b."workspace_slug" IS NULL;
