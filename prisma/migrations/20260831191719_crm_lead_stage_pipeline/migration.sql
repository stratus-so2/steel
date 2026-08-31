/*
  Warnings:

  - You are about to drop the column `status` on the `crm_leads` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CrmLeadStage" AS ENUM ('RECEIVED', 'IN_CONTACT', 'QUALIFIED', 'OPPORTUNITY', 'PROPOSAL', 'CLOSED');

-- CreateEnum
CREATE TYPE "CrmLeadContactChannel" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmLeadContactOutcome" AS ENUM ('ATTEMPTED', 'REACHED');

-- CreateEnum
CREATE TYPE "CrmLeadMeetingFormat" AS ENUM ('IN_PERSON', 'ONLINE');

-- CreateEnum
CREATE TYPE "CrmLeadProposalFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmLeadInterestLevel" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "CrmLeadCloseResult" AS ENUM ('WON', 'LOST');

-- DropIndex
DROP INDEX "crm_leads_status_idx";

-- AlterTable
ALTER TABLE "crm_leads" DROP COLUMN "status",
ADD COLUMN     "billing_type" "CrmBillingType",
ADD COLUMN     "close_result" "CrmLeadCloseResult",
ADD COLUMN     "closed_amount" DECIMAL(14,2),
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "contract_signed_at" TIMESTAMP(3),
ADD COLUMN     "lost_note" TEXT,
ADD COLUMN     "lost_reason" TEXT,
ADD COLUMN     "retry_at" TIMESTAMP(3),
ADD COLUMN     "stage" "CrmLeadStage" NOT NULL DEFAULT 'RECEIVED';

-- AlterTable
ALTER TABLE "crm_notes" ADD COLUMN     "lead_id" TEXT;

-- AlterTable
ALTER TABLE "crm_proposals" ADD COLUMN     "lead_id" TEXT;

-- DropEnum
DROP TYPE "CrmLeadStatus";

-- CreateTable
CREATE TABLE "crm_lead_contact_attempts" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contacted_with" TEXT NOT NULL,
    "channel" "CrmLeadContactChannel" NOT NULL,
    "outcome" "CrmLeadContactOutcome" NOT NULL DEFAULT 'ATTEMPTED',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_contact_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_interest_products" (
    "lead_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_interest_products_pkey" PRIMARY KEY ("lead_id","product_id")
);

-- CreateTable
CREATE TABLE "crm_lead_qualifications" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "expected_close_at" TIMESTAMP(3),
    "decision_maker_name" TEXT NOT NULL,
    "decision_maker_role" TEXT NOT NULL,
    "qualified_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lead_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_meetings" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "format" "CrmLeadMeetingFormat" NOT NULL,
    "contact_person_id" TEXT,
    "contact_person_name" TEXT,
    "interest_details" TEXT NOT NULL,
    "identified_need" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_proposal_presentations" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "presented_at" TIMESTAMP(3) NOT NULL,
    "format" "CrmLeadProposalFormat" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "interest_level" "CrmLeadInterestLevel" NOT NULL,
    "interactions_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_proposal_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_lead_contact_attempts_lead_id_occurred_at_idx" ON "crm_lead_contact_attempts"("lead_id", "occurred_at");

-- CreateIndex
CREATE INDEX "crm_lead_contact_attempts_workspace_id_idx" ON "crm_lead_contact_attempts"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_lead_interest_products_product_id_idx" ON "crm_lead_interest_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lead_qualifications_lead_id_key" ON "crm_lead_qualifications"("lead_id");

-- CreateIndex
CREATE INDEX "crm_lead_meetings_lead_id_scheduled_at_idx" ON "crm_lead_meetings"("lead_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "crm_lead_meetings_workspace_id_idx" ON "crm_lead_meetings"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_lead_proposal_presentations_lead_id_presented_at_idx" ON "crm_lead_proposal_presentations"("lead_id", "presented_at");

-- CreateIndex
CREATE INDEX "crm_lead_proposal_presentations_proposal_id_idx" ON "crm_lead_proposal_presentations"("proposal_id");

-- CreateIndex
CREATE INDEX "crm_leads_stage_idx" ON "crm_leads"("stage");

-- CreateIndex
CREATE INDEX "crm_notes_lead_id_idx" ON "crm_notes"("lead_id");

-- CreateIndex
CREATE INDEX "crm_proposals_lead_id_idx" ON "crm_proposals"("lead_id");

-- AddForeignKey
ALTER TABLE "crm_lead_contact_attempts" ADD CONSTRAINT "crm_lead_contact_attempts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_contact_attempts" ADD CONSTRAINT "crm_lead_contact_attempts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_contact_attempts" ADD CONSTRAINT "crm_lead_contact_attempts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_interest_products" ADD CONSTRAINT "crm_lead_interest_products_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_interest_products" ADD CONSTRAINT "crm_lead_interest_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "crm_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_qualifications" ADD CONSTRAINT "crm_lead_qualifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_qualifications" ADD CONSTRAINT "crm_lead_qualifications_qualified_by_id_fkey" FOREIGN KEY ("qualified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_meetings" ADD CONSTRAINT "crm_lead_meetings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_meetings" ADD CONSTRAINT "crm_lead_meetings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_meetings" ADD CONSTRAINT "crm_lead_meetings_contact_person_id_fkey" FOREIGN KEY ("contact_person_id") REFERENCES "crm_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_meetings" ADD CONSTRAINT "crm_lead_meetings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_proposal_presentations" ADD CONSTRAINT "crm_lead_proposal_presentations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_proposal_presentations" ADD CONSTRAINT "crm_lead_proposal_presentations_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "crm_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_proposal_presentations" ADD CONSTRAINT "crm_lead_proposal_presentations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
