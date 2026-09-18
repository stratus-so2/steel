-- CreateEnum
CREATE TYPE "WhatsAppOptOutSource" AS ENUM ('KEYWORD', 'ADMIN');

-- CreateEnum
CREATE TYPE "CrmEmailOptOutSource" AS ENUM ('LINK', 'ONE_CLICK');

-- AlterEnum
ALTER TYPE "CrmCampaignRecipientStatus" ADD VALUE 'SKIPPED';

-- AlterEnum
ALTER TYPE "WhatsAppBroadcastRecipientStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "whatsapp_contacts" ADD COLUMN     "broadcast_opt_out_source" "WhatsAppOptOutSource",
ADD COLUMN     "broadcast_opted_out_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "crm_email_opt_outs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "person_id" TEXT,
    "campaign_id" TEXT,
    "source" "CrmEmailOptOutSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_email_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_email_opt_outs_workspace_id_idx" ON "crm_email_opt_outs"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_email_opt_outs_person_id_idx" ON "crm_email_opt_outs"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_email_opt_outs_workspace_id_email_key" ON "crm_email_opt_outs"("workspace_id", "email");

-- AddForeignKey
ALTER TABLE "crm_email_opt_outs" ADD CONSTRAINT "crm_email_opt_outs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
