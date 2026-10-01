-- CreateEnum
CREATE TYPE "SdMailboxProtocol" AS ENUM ('IMAP');

-- CreateEnum
CREATE TYPE "SdMailboxStatus" AS ENUM ('ACTIVE', 'ERROR', 'PAUSED');

-- CreateEnum
CREATE TYPE "SdMailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "SdMonitorKind" AS ENUM ('ZABBIX', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "SdMonitorAlertStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SdNotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateTable
CREATE TABLE "sd_mailboxes" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "protocol" "SdMailboxProtocol" NOT NULL DEFAULT 'IMAP',
    "status" "SdMailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_error" TEXT,
    "imap_host" TEXT NOT NULL,
    "imap_port" INTEGER NOT NULL DEFAULT 993,
    "imap_secure" BOOLEAN NOT NULL DEFAULT true,
    "imap_user" TEXT NOT NULL,
    "encrypted_imap_password" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "processed_folder" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT true,
    "smtp_user" TEXT,
    "encrypted_smtp_password" TEXT,
    "default_type" "SdTicketType" NOT NULL DEFAULT 'INCIDENT',
    "default_department_id" TEXT,
    "default_category_id" TEXT,
    "default_priority_id" TEXT,
    "allowed_senders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blocked_senders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "create_unknown_contacts" BOOLEAN NOT NULL DEFAULT true,
    "send_acknowledgement" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_seen_uid" INTEGER,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_mail_messages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "message_id" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "direction" "SdMailDirection" NOT NULL,
    "from_address" TEXT NOT NULL,
    "from_name" TEXT,
    "to_addresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cc_addresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT,
    "body_text" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_mail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_monitor_sources" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SdMonitorKind" NOT NULL DEFAULT 'ZABBIX',
    "token_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ticket_type" "SdTicketType" NOT NULL DEFAULT 'INCIDENT',
    "department_id" TEXT,
    "category_id" TEXT,
    "customer_id" TEXT,
    "severity_map" JSONB NOT NULL DEFAULT '[]',
    "auto_resolve" BOOLEAN NOT NULL DEFAULT true,
    "flapping_window_minutes" INTEGER NOT NULL DEFAULT 30,
    "last_event_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_monitor_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_monitor_alerts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "external_id" TEXT NOT NULL,
    "status" "SdMonitorAlertStatus" NOT NULL DEFAULT 'OPEN',
    "severity" TEXT,
    "host" TEXT,
    "config_item_id" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_monitor_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_portal_accesses" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requested_by_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "session_hash" TEXT,
    "session_expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_portal_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_notification_preferences" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channel" "SdNotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_followers" (
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_ticket_followers_pkey" PRIMARY KEY ("ticket_id","user_id")
);

-- CreateIndex
CREATE INDEX "sd_mailboxes_workspace_id_status_idx" ON "sd_mailboxes"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sd_mailboxes_workspace_id_address_key" ON "sd_mailboxes"("workspace_id", "address");

-- CreateIndex
CREATE INDEX "sd_mail_messages_ticket_id_idx" ON "sd_mail_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_mail_messages_workspace_id_created_at_idx" ON "sd_mail_messages"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sd_mail_messages_mailbox_id_message_id_key" ON "sd_mail_messages"("mailbox_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_monitor_sources_token_hash_key" ON "sd_monitor_sources"("token_hash");

-- CreateIndex
CREATE INDEX "sd_monitor_sources_workspace_id_idx" ON "sd_monitor_sources"("workspace_id");

-- CreateIndex
CREATE INDEX "sd_monitor_alerts_workspace_id_status_idx" ON "sd_monitor_alerts"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "sd_monitor_alerts_ticket_id_idx" ON "sd_monitor_alerts"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_monitor_alerts_source_id_external_id_key" ON "sd_monitor_alerts"("source_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_portal_accesses_token_hash_key" ON "sd_portal_accesses"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sd_portal_accesses_session_hash_key" ON "sd_portal_accesses"("session_hash");

-- CreateIndex
CREATE INDEX "sd_portal_accesses_workspace_id_contact_id_idx" ON "sd_portal_accesses"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "sd_portal_accesses_expires_at_idx" ON "sd_portal_accesses"("expires_at");

-- CreateIndex
CREATE INDEX "sd_notification_preferences_workspace_id_user_id_idx" ON "sd_notification_preferences"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_notification_preferences_workspace_id_user_id_event_chan_key" ON "sd_notification_preferences"("workspace_id", "user_id", "event", "channel");

-- CreateIndex
CREATE INDEX "sd_ticket_followers_user_id_idx" ON "sd_ticket_followers"("user_id");

-- AddForeignKey
ALTER TABLE "sd_mailboxes" ADD CONSTRAINT "sd_mailboxes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_mailboxes" ADD CONSTRAINT "sd_mailboxes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_mail_messages" ADD CONSTRAINT "sd_mail_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_mail_messages" ADD CONSTRAINT "sd_mail_messages_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "sd_mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_mail_messages" ADD CONSTRAINT "sd_mail_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_monitor_sources" ADD CONSTRAINT "sd_monitor_sources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_monitor_sources" ADD CONSTRAINT "sd_monitor_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_monitor_alerts" ADD CONSTRAINT "sd_monitor_alerts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_monitor_alerts" ADD CONSTRAINT "sd_monitor_alerts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sd_monitor_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_monitor_alerts" ADD CONSTRAINT "sd_monitor_alerts_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_monitor_alerts" ADD CONSTRAINT "sd_monitor_alerts_config_item_id_fkey" FOREIGN KEY ("config_item_id") REFERENCES "sd_config_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_portal_accesses" ADD CONSTRAINT "sd_portal_accesses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_portal_accesses" ADD CONSTRAINT "sd_portal_accesses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sd_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_portal_accesses" ADD CONSTRAINT "sd_portal_accesses_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_notification_preferences" ADD CONSTRAINT "sd_notification_preferences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_notification_preferences" ADD CONSTRAINT "sd_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_followers" ADD CONSTRAINT "sd_ticket_followers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_followers" ADD CONSTRAINT "sd_ticket_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
