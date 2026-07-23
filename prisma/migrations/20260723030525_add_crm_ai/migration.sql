-- CreateEnum
CREATE TYPE "CrmAiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "crm_ai_conversations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "CrmAiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_ai_usage" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_ai_conversations_workspace_id_user_id_idx" ON "crm_ai_conversations"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "crm_ai_messages_conversation_id_idx" ON "crm_ai_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "crm_ai_usage_workspace_id_idx" ON "crm_ai_usage"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_ai_usage_conversation_id_idx" ON "crm_ai_usage"("conversation_id");

-- CreateIndex
CREATE INDEX "crm_ai_usage_created_at_idx" ON "crm_ai_usage"("created_at");

-- AddForeignKey
ALTER TABLE "crm_ai_conversations" ADD CONSTRAINT "crm_ai_conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_ai_conversations" ADD CONSTRAINT "crm_ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_ai_messages" ADD CONSTRAINT "crm_ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "crm_ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_ai_usage" ADD CONSTRAINT "crm_ai_usage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_ai_usage" ADD CONSTRAINT "crm_ai_usage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "crm_ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
