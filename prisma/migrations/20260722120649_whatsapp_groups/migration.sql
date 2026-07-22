-- CreateEnum
CREATE TYPE "WhatsAppGroupParticipantRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "WhatsAppGroupMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "whatsapp_groups" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "group_jid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "description" TEXT,
    "invite_link" TEXT,
    "last_message_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_group_participants" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "name" TEXT,
    "role" "WhatsAppGroupParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_group_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_group_messages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "type" "WhatsAppMessageType" NOT NULL,
    "text" TEXT,
    "media_url" TEXT,
    "provider_message_id" TEXT,
    "status" "WhatsAppGroupMessageStatus" NOT NULL DEFAULT 'PENDING',
    "sender_user_id" TEXT,
    "sender_wa_id" TEXT,
    "sender_name" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_group_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_groups_workspace_id_archived_at_last_message_at_idx" ON "whatsapp_groups"("workspace_id", "archived_at", "last_message_at");

-- CreateIndex
CREATE INDEX "whatsapp_groups_connection_id_idx" ON "whatsapp_groups"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_groups_workspace_id_group_jid_key" ON "whatsapp_groups"("workspace_id", "group_jid");

-- CreateIndex
CREATE INDEX "whatsapp_group_participants_group_id_idx" ON "whatsapp_group_participants"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_group_participants_group_id_wa_id_key" ON "whatsapp_group_participants"("group_id", "wa_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_group_messages_provider_message_id_key" ON "whatsapp_group_messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_group_messages_workspace_id_idx" ON "whatsapp_group_messages"("workspace_id");

-- CreateIndex
CREATE INDEX "whatsapp_group_messages_group_id_created_at_idx" ON "whatsapp_group_messages"("group_id", "created_at");

-- AddForeignKey
ALTER TABLE "whatsapp_groups" ADD CONSTRAINT "whatsapp_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_groups" ADD CONSTRAINT "whatsapp_groups_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_group_participants" ADD CONSTRAINT "whatsapp_group_participants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "whatsapp_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_group_messages" ADD CONSTRAINT "whatsapp_group_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_group_messages" ADD CONSTRAINT "whatsapp_group_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "whatsapp_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_group_messages" ADD CONSTRAINT "whatsapp_group_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
