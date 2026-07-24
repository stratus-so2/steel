-- CreateEnum
CREATE TYPE "CrmWorkflowVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "CrmWorkflowRunStatus" ADD VALUE 'WAITING';
ALTER TYPE "CrmWorkflowRunStatus" ADD VALUE 'CANCELED';

-- DropIndex
DROP INDEX "crm_workflows_webhook_token_key";

-- AlterTable
ALTER TABLE "crm_workflow_runs" ADD COLUMN     "state" JSONB,
ADD COLUMN     "version_id" TEXT NOT NULL,
ADD COLUMN     "waiting_step_id" TEXT;

-- AlterTable: drop trigger_type/webhook_token/definition from crm_workflows
-- BEFORE the enum rename below — the enum can't be renamed while a column
-- still depends on it.
ALTER TABLE "crm_workflows" DROP COLUMN "definition",
DROP COLUMN "trigger_type",
DROP COLUMN "webhook_token",
ADD COLUMN     "active_version_id" TEXT;

-- AlterEnum: crm_workflow_runs.trigger_type is the only remaining column
-- using this enum now that crm_workflows.trigger_type is gone.
BEGIN;
CREATE TYPE "CrmWorkflowTriggerType_new" AS ENUM ('RECORD_IS_CREATED', 'RECORD_IS_UPDATED', 'RECORD_IS_DELETED', 'RECORD_IS_CREATED_OR_UPDATED', 'LAUNCH_MANUALLY', 'ON_A_SCHEDULE', 'WEBHOOK');
ALTER TABLE "crm_workflow_runs" ALTER COLUMN "trigger_type" TYPE "CrmWorkflowTriggerType_new" USING ("trigger_type"::text::"CrmWorkflowTriggerType_new");
ALTER TYPE "CrmWorkflowTriggerType" RENAME TO "CrmWorkflowTriggerType_old";
ALTER TYPE "CrmWorkflowTriggerType_new" RENAME TO "CrmWorkflowTriggerType";
DROP TYPE "public"."CrmWorkflowTriggerType_old";
COMMIT;

-- CreateTable
CREATE TABLE "crm_workflow_versions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "CrmWorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_workflow_versions_workflow_id_idx" ON "crm_workflow_versions"("workflow_id");

-- CreateIndex
CREATE INDEX "crm_workflow_versions_status_idx" ON "crm_workflow_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_workflow_versions_workflow_id_version_key" ON "crm_workflow_versions"("workflow_id", "version");

-- CreateIndex
CREATE INDEX "crm_workflow_runs_version_id_idx" ON "crm_workflow_runs"("version_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_workflows_active_version_id_key" ON "crm_workflows"("active_version_id");

-- AddForeignKey
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "crm_workflow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_versions" ADD CONSTRAINT "crm_workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "crm_workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
