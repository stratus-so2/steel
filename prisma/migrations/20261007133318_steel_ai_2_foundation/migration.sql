-- CreateEnum
CREATE TYPE "AiAttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AiScope" AS ENUM ('WORKSPACE', 'PERSONAL');

-- CreateEnum
CREATE TYPE "AiMemorySource" AS ENUM ('AUTO', 'MANUAL');

-- AlterEnum
ALTER TYPE "AiConversationMode" ADD VALUE 'AUTOPILOT';

-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "agent_run_id" TEXT,
ADD COLUMN     "conversation_id" TEXT,
ADD COLUMN     "module" "ModuleKind";

-- AlterTable
ALTER TABLE "workspace_ai_settings" ADD COLUMN     "agents_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autopilot_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memory_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ai_attachments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "kind" "AiAttachmentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "extracted_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skills" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "scope" "AiScope" NOT NULL,
    "owner_id" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "mode" "AiConversationMode",
    "tool_names" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "scope" "AiScope" NOT NULL,
    "user_id" TEXT,
    "content" TEXT NOT NULL,
    "source" "AiMemorySource" NOT NULL,
    "source_conversation_id" TEXT,
    "created_by_id" TEXT,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_attachments_conversation_id_idx" ON "ai_attachments"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_attachments_message_id_idx" ON "ai_attachments"("message_id");

-- CreateIndex
CREATE INDEX "ai_skills_workspace_id_scope_idx" ON "ai_skills"("workspace_id", "scope");

-- CreateIndex
CREATE INDEX "ai_skills_workspace_id_owner_id_idx" ON "ai_skills"("workspace_id", "owner_id");

-- CreateIndex
CREATE INDEX "ai_memories_workspace_id_scope_idx" ON "ai_memories"("workspace_id", "scope");

-- CreateIndex
CREATE INDEX "ai_memories_workspace_id_user_id_idx" ON "ai_memories"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "ai_usage_workspace_id_user_id_created_at_idx" ON "ai_usage"("workspace_id", "user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_attachments" ADD CONSTRAINT "ai_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skills" ADD CONSTRAINT "ai_skills_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
