-- CreateEnum
CREATE TYPE "CrmCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "CrmCampaignRecipientScope" AS ENUM ('ALL', 'SELECTED');

-- CreateEnum
CREATE TYPE "CrmCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "crm_email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content_html" TEXT NOT NULL,
    "content_json" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_email_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content_html" TEXT NOT NULL,
    "content_json" TEXT,
    "from_address" TEXT NOT NULL,
    "status" "CrmCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "recipient_scope" "CrmCampaignRecipientScope" NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_email_campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "person_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "CrmCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_email_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_mailing_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_mailing_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_mailing_list_members" (
    "id" TEXT NOT NULL,
    "mailing_list_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "person_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_mailing_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_email_templates_workspace_id_idx" ON "crm_email_templates"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_email_templates_deleted_at_idx" ON "crm_email_templates"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_email_campaigns_workspace_id_idx" ON "crm_email_campaigns"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_email_campaigns_status_idx" ON "crm_email_campaigns"("status");

-- CreateIndex
CREATE INDEX "crm_email_campaign_recipients_campaign_id_idx" ON "crm_email_campaign_recipients"("campaign_id");

-- CreateIndex
CREATE INDEX "crm_email_campaign_recipients_person_id_idx" ON "crm_email_campaign_recipients"("person_id");

-- CreateIndex
CREATE INDEX "crm_email_campaign_recipients_status_idx" ON "crm_email_campaign_recipients"("status");

-- CreateIndex
CREATE INDEX "crm_mailing_lists_workspace_id_idx" ON "crm_mailing_lists"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_mailing_lists_deleted_at_idx" ON "crm_mailing_lists"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_mailing_list_members_mailing_list_id_idx" ON "crm_mailing_list_members"("mailing_list_id");

-- CreateIndex
CREATE INDEX "crm_mailing_list_members_person_id_idx" ON "crm_mailing_list_members"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_mailing_list_members_mailing_list_id_email_key" ON "crm_mailing_list_members"("mailing_list_id", "email");

-- AddForeignKey
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_campaigns" ADD CONSTRAINT "crm_email_campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_campaigns" ADD CONSTRAINT "crm_email_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_campaign_recipients" ADD CONSTRAINT "crm_email_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mailing_lists" ADD CONSTRAINT "crm_mailing_lists_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mailing_lists" ADD CONSTRAINT "crm_mailing_lists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mailing_list_members" ADD CONSTRAINT "crm_mailing_list_members_mailing_list_id_fkey" FOREIGN KEY ("mailing_list_id") REFERENCES "crm_mailing_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
