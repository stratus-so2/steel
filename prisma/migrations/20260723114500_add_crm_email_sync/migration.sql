-- CreateEnum
CREATE TYPE "CrmEmailProvider" AS ENUM ('GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "CrmMailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "crm_email_accounts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "CrmEmailProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_email_messages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "account_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "direction" "CrmMailDirection" NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "from_email" TEXT NOT NULL,
    "to_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "person_id" TEXT,
    "opportunity_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_calendar_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "account_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "attendees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "person_id" TEXT,
    "opportunity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_email_accounts_workspace_id_idx" ON "crm_email_accounts"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_email_accounts_workspace_id_user_id_provider_key" ON "crm_email_accounts"("workspace_id", "user_id", "provider");

-- CreateIndex
CREATE INDEX "crm_email_messages_workspace_id_idx" ON "crm_email_messages"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_email_messages_person_id_sent_at_idx" ON "crm_email_messages"("person_id", "sent_at");

-- CreateIndex
CREATE INDEX "crm_email_messages_opportunity_id_sent_at_idx" ON "crm_email_messages"("opportunity_id", "sent_at");

-- CreateIndex
CREATE INDEX "crm_calendar_events_workspace_id_idx" ON "crm_calendar_events"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_calendar_events_person_id_starts_at_idx" ON "crm_calendar_events"("person_id", "starts_at");

-- CreateIndex
CREATE INDEX "crm_calendar_events_opportunity_id_starts_at_idx" ON "crm_calendar_events"("opportunity_id", "starts_at");

-- AddForeignKey
ALTER TABLE "crm_email_accounts" ADD CONSTRAINT "crm_email_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_accounts" ADD CONSTRAINT "crm_email_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_messages" ADD CONSTRAINT "crm_email_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_messages" ADD CONSTRAINT "crm_email_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_email_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_messages" ADD CONSTRAINT "crm_email_messages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_messages" ADD CONSTRAINT "crm_email_messages_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "crm_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_messages" ADD CONSTRAINT "crm_email_messages_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_calendar_events" ADD CONSTRAINT "crm_calendar_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_calendar_events" ADD CONSTRAINT "crm_calendar_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_email_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_calendar_events" ADD CONSTRAINT "crm_calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_calendar_events" ADD CONSTRAINT "crm_calendar_events_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "crm_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_calendar_events" ADD CONSTRAINT "crm_calendar_events_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
