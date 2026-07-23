-- CreateEnum
CREATE TYPE "CrmWorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "CrmWorkflowTriggerType" AS ENUM ('MANUAL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "CrmWorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrmWorkflowRunStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "crm_workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "trigger_type" "CrmWorkflowTriggerType" NOT NULL,
    "definition" JSONB NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_workflow_runs" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "status" "CrmWorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
    "trigger_type" "CrmWorkflowTriggerType" NOT NULL,
    "trigger_payload" JSONB NOT NULL DEFAULT '{}',
    "started_by_id" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_workflow_run_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_type" TEXT NOT NULL,
    "status" "CrmWorkflowRunStepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workflow_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_workflows_workspace_id_idx" ON "crm_workflows"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_workflows_status_idx" ON "crm_workflows"("status");

-- CreateIndex
CREATE INDEX "crm_workflows_deleted_at_idx" ON "crm_workflows"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_workflow_runs_workflow_id_idx" ON "crm_workflow_runs"("workflow_id");

-- CreateIndex
CREATE INDEX "crm_workflow_runs_status_idx" ON "crm_workflow_runs"("status");

-- CreateIndex
CREATE INDEX "crm_workflow_runs_workflow_id_created_at_idx" ON "crm_workflow_runs"("workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_workflow_run_steps_run_id_idx" ON "crm_workflow_run_steps"("run_id");

-- CreateIndex
CREATE INDEX "crm_workflow_run_steps_status_idx" ON "crm_workflow_run_steps"("status");

-- AddForeignKey
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_run_steps" ADD CONSTRAINT "crm_workflow_run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "crm_workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
