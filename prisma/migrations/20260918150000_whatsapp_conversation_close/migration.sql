-- CreateEnum
CREATE TYPE "WhatsAppConversationEventKind" AS ENUM ('CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "WhatsAppConversationEventSource" AS ENUM ('AGENT', 'CONTACT', 'INACTIVITY');

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "close_reason" TEXT,
ADD COLUMN     "closed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "whatsapp_conversation_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "kind" "WhatsAppConversationEventKind" NOT NULL,
    "source" "WhatsAppConversationEventSource" NOT NULL,
    "actor_user_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_settings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "auto_close_after_hours" INTEGER NOT NULL DEFAULT 24,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_conversation_events_conversation_id_created_at_idx" ON "whatsapp_conversation_events"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_conversation_events_workspace_id_idx" ON "whatsapp_conversation_events"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_settings_workspace_id_key" ON "whatsapp_settings"("workspace_id");

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_events" ADD CONSTRAINT "whatsapp_conversation_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_events" ADD CONSTRAINT "whatsapp_conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_events" ADD CONSTRAINT "whatsapp_conversation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

