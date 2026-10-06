-- CreateEnum
CREATE TYPE "AiConversationMode" AS ENUM ('EXPLORE', 'AGENT');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "AiActionKind" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ACTION');

-- CreateEnum
CREATE TYPE "AiPendingActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiActionSource" AS ENUM ('ASSISTANT', 'AGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiUsageFeature" ADD VALUE 'STEEL_ASSISTANT';
ALTER TYPE "AiUsageFeature" ADD VALUE 'STEEL_AGENT';

-- AlterTable
ALTER TABLE "workspace_ai_settings" ADD COLUMN     "agent_mode_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "mode" "AiConversationMode" NOT NULL DEFAULT 'EXPLORE',
    "model_key" TEXT,
    "pinned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "tool_call_id" TEXT,
    "tool_name" TEXT,
    "raw" JSONB,
    "model_key" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_pending_actions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "requested_by_id" TEXT,
    "conversation_id" TEXT,
    "agent_run_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "tool_call_id" TEXT,
    "kind" "AiActionKind" NOT NULL,
    "module" "ModuleKind",
    "args" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "status" "AiPendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "requires_double_confirm" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "error" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "source" "AiActionSource" NOT NULL,
    "actor_id" TEXT,
    "agent_id" TEXT,
    "pending_action_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "kind" "AiActionKind" NOT NULL,
    "module" "ModuleKind",
    "target_type" TEXT,
    "target_id" TEXT,
    "args" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_workspace_id_user_id_updated_at_idx" ON "ai_conversations"("workspace_id", "user_id", "updated_at");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_pending_actions_workspace_id_status_idx" ON "ai_pending_actions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ai_pending_actions_conversation_id_idx" ON "ai_pending_actions"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_pending_actions_agent_run_id_idx" ON "ai_pending_actions"("agent_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_action_logs_pending_action_id_key" ON "ai_action_logs"("pending_action_id");

-- CreateIndex
CREATE INDEX "ai_action_logs_workspace_id_created_at_idx" ON "ai_action_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_action_logs_target_type_target_id_idx" ON "ai_action_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
