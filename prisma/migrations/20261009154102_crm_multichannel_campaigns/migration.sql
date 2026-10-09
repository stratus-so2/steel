-- CreateEnum
CREATE TYPE "CrmCampaignRunStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrmCampaignDestinationType" AS ENUM ('LANDING_PAGE', 'FORM');

-- CreateEnum
CREATE TYPE "CrmCampaignLegalBasis" AS ENUM ('CONSENT', 'LEGITIMATE_INTEREST', 'CONTRACT');

-- CreateEnum
CREATE TYPE "CrmCampaignDeliveryStatus" AS ENUM ('NONE', 'PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CrmCampaignChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "CrmCampaignConversionKind" AS ENUM ('LANDING_VIEW', 'FORM_SUBMISSION');

-- CreateTable
CREATE TABLE "crm_campaigns" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CrmCampaignRunStatus" NOT NULL DEFAULT 'DRAFT',
    "destination_type" "CrmCampaignDestinationType",
    "landing_page_id" TEXT,
    "form_id" TEXT,
    "utm_medium" TEXT NOT NULL DEFAULT 'campanha',
    "email_from" TEXT,
    "email_subject" TEXT,
    "email_preheader" TEXT,
    "email_template_id" TEXT,
    "email_legal_basis" "CrmCampaignLegalBasis",
    "audience" JSONB NOT NULL DEFAULT '{}',
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_connection_id" TEXT,
    "whatsapp_template_id" TEXT,
    "whatsapp_variables" JSONB,
    "whatsapp_text" TEXT,
    "whatsapp_media_url" TEXT,
    "whatsapp_delay_hours" INTEGER NOT NULL DEFAULT 0,
    "whatsapp_legal_basis" "CrmCampaignLegalBasis",
    "scheduled_at" TIMESTAMP(3),
    "send_window_start_hour" INTEGER,
    "send_window_end_hour" INTEGER,
    "send_weekdays_only" BOOLEAN NOT NULL DEFAULT false,
    "consent_confirmed_at" TIMESTAMP(3),
    "consent_confirmed_by_id" TEXT,
    "launched_at" TIMESTAMP(3),
    "start_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "person_id" TEXT,
    "lead_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "wa_id" TEXT,
    "email_status" "CrmCampaignDeliveryStatus" NOT NULL DEFAULT 'NONE',
    "email_skip_reason" TEXT,
    "email_provider_message_id" TEXT,
    "email_error" TEXT,
    "email_sent_at" TIMESTAMP(3),
    "email_delivered_at" TIMESTAMP(3),
    "email_opened_at" TIMESTAMP(3),
    "email_clicked_at" TIMESTAMP(3),
    "email_bounced_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "whatsapp_status" "CrmCampaignDeliveryStatus" NOT NULL DEFAULT 'NONE',
    "whatsapp_skip_reason" TEXT,
    "whatsapp_provider_message_id" TEXT,
    "whatsapp_error" TEXT,
    "whatsapp_sent_at" TIMESTAMP(3),
    "whatsapp_delivered_at" TIMESTAMP(3),
    "whatsapp_read_at" TIMESTAMP(3),
    "whatsapp_clicked_at" TIMESTAMP(3),
    "whatsapp_replied_at" TIMESTAMP(3),
    "conversation_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_campaign_conversions" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "channel" "CrmCampaignChannel",
    "kind" "CrmCampaignConversionKind" NOT NULL,
    "source_ref" TEXT NOT NULL,
    "lead_id" TEXT,
    "person_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_campaign_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_campaigns_workspace_id_deleted_at_idx" ON "crm_campaigns"("workspace_id", "deleted_at");

-- CreateIndex
CREATE INDEX "crm_campaigns_status_start_at_idx" ON "crm_campaigns"("status", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_campaigns_workspace_id_slug_key" ON "crm_campaigns"("workspace_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "crm_campaign_recipients_email_provider_message_id_key" ON "crm_campaign_recipients"("email_provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_campaign_recipients_whatsapp_provider_message_id_key" ON "crm_campaign_recipients"("whatsapp_provider_message_id");

-- CreateIndex
CREATE INDEX "crm_campaign_recipients_campaign_id_email_status_idx" ON "crm_campaign_recipients"("campaign_id", "email_status");

-- CreateIndex
CREATE INDEX "crm_campaign_recipients_campaign_id_whatsapp_status_idx" ON "crm_campaign_recipients"("campaign_id", "whatsapp_status");

-- CreateIndex
CREATE INDEX "crm_campaign_recipients_workspace_id_wa_id_idx" ON "crm_campaign_recipients"("workspace_id", "wa_id");

-- CreateIndex
CREATE INDEX "crm_campaign_conversions_campaign_id_created_at_idx" ON "crm_campaign_conversions"("campaign_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_campaign_conversions_campaign_id_kind_source_ref_key" ON "crm_campaign_conversions"("campaign_id", "kind", "source_ref");

-- AddForeignKey
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campaign_conversions" ADD CONSTRAINT "crm_campaign_conversions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campaign_conversions" ADD CONSTRAINT "crm_campaign_conversions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "crm_campaign_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
