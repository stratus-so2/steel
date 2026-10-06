-- CreateEnum
CREATE TYPE "SteelAgentTriggerType" AS ENUM ('SCHEDULE', 'EVENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "SteelAgentToolMode" AS ENUM ('AUTO', 'APPROVAL');

-- CreateEnum
CREATE TYPE "SteelAgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SteelAgentRunStepKind" AS ENUM ('MODEL', 'TOOL', 'APPROVAL');

-- CreateEnum
CREATE TYPE "SteelAgentRunStepStatus" AS ENUM ('OK', 'FAILED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'AGENT_APPROVAL_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'AGENT_RUN_FAILED';

-- CreateTable
CREATE TABLE "steel_agents" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT NOT NULL,
    "trigger_type" "SteelAgentTriggerType" NOT NULL,
    "cron" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "event_key" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" TEXT,
    "created_by_id" TEXT,
    "max_tool_rounds" INTEGER NOT NULL DEFAULT 8,
    "monthly_run_cap" INTEGER,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steel_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steel_agent_tools" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "mode" "SteelAgentToolMode" NOT NULL DEFAULT 'APPROVAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "steel_agent_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steel_agent_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" "SteelAgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger_type" "SteelAgentTriggerType" NOT NULL,
    "trigger_payload" JSONB,
    "started_by_id" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "summary" TEXT,
    "error" TEXT,
    "model_key" TEXT,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "state" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steel_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steel_agent_run_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "kind" "SteelAgentRunStepKind" NOT NULL,
    "tool_name" TEXT,
    "tool_call_id" TEXT,
    "pending_action_id" TEXT,
    "input" JSONB,
    "output" JSONB,
    "status" "SteelAgentRunStepStatus" NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steel_agent_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "steel_agents_workspace_id_idx" ON "steel_agents"("workspace_id");

-- CreateIndex
CREATE INDEX "steel_agents_trigger_type_enabled_idx" ON "steel_agents"("trigger_type", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "steel_agent_tools_agent_id_tool_name_key" ON "steel_agent_tools"("agent_id", "tool_name");

-- CreateIndex
CREATE INDEX "steel_agent_runs_agent_id_created_at_idx" ON "steel_agent_runs"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "steel_agent_runs_workspace_id_status_idx" ON "steel_agent_runs"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "steel_agent_run_steps_run_id_created_at_idx" ON "steel_agent_run_steps"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "steel_agent_run_steps_pending_action_id_idx" ON "steel_agent_run_steps"("pending_action_id");

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "steel_agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agents" ADD CONSTRAINT "steel_agents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agents" ADD CONSTRAINT "steel_agents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agents" ADD CONSTRAINT "steel_agents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agent_tools" ADD CONSTRAINT "steel_agent_tools_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "steel_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agent_runs" ADD CONSTRAINT "steel_agent_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agent_runs" ADD CONSTRAINT "steel_agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "steel_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agent_runs" ADD CONSTRAINT "steel_agent_runs_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_agent_run_steps" ADD CONSTRAINT "steel_agent_run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "steel_agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
