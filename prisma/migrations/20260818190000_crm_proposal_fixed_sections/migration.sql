-- CreateEnum
CREATE TYPE "CrmProposalSectionType" AS ENUM ('COVER', 'COMPANY_PRESENTATION', 'CLIENT_NEEDS', 'SOLUTION', 'SCOPE', 'PRODUCTS_PRICING', 'COMMERCIAL_TERMS', 'TERMS_CONDITIONS', 'SIGNATURE');

-- Feature replaced by fixed-section proposals (no locked-layout data existed under
-- the old freeform TipTap model, so old rows are discarded rather than migrated).
TRUNCATE TABLE "crm_proposals" CASCADE;

-- AlterEnum
BEGIN;
CREATE TYPE "CrmProposalStatus_new" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
ALTER TABLE "public"."crm_proposals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "crm_proposals" ALTER COLUMN "status" TYPE "CrmProposalStatus_new" USING ("status"::text::"CrmProposalStatus_new");
ALTER TYPE "CrmProposalStatus" RENAME TO "CrmProposalStatus_old";
ALTER TYPE "CrmProposalStatus_new" RENAME TO "CrmProposalStatus";
DROP TYPE "public"."CrmProposalStatus_old";
ALTER TABLE "crm_proposals" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "crm_document_templates" DROP CONSTRAINT "crm_document_templates_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "crm_document_templates" DROP CONSTRAINT "crm_document_templates_workspace_id_fkey";

-- AlterTable
ALTER TABLE "crm_proposals" DROP COLUMN "content",
DROP COLUMN "content_json",
DROP COLUMN "published_at",
DROP COLUMN "title",
DROP COLUMN "type",
ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "contact_id" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "opportunity_id" TEXT,
ADD COLUMN     "responsible_id" TEXT NOT NULL,
ADD COLUMN     "template_id" TEXT,
ADD COLUMN     "valid_until" TIMESTAMP(3);

-- DropTable
DROP TABLE "crm_document_templates";

-- DropEnum
DROP TYPE "CrmDocumentType";

-- CreateTable
CREATE TABLE "crm_proposal_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo_key" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_proposal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_proposal_template_sections" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "type" "CrmProposalSectionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_content" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_proposal_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_proposal_sections" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "type" "CrmProposalSectionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_proposal_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_proposal_templates_workspace_id_idx" ON "crm_proposal_templates"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_proposal_templates_deleted_at_idx" ON "crm_proposal_templates"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_proposal_templates_workspace_id_position_idx" ON "crm_proposal_templates"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_proposal_template_sections_template_id_idx" ON "crm_proposal_template_sections"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_proposal_template_sections_template_id_type_key" ON "crm_proposal_template_sections"("template_id", "type");

-- CreateIndex
CREATE INDEX "crm_proposal_sections_proposal_id_idx" ON "crm_proposal_sections"("proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_proposal_sections_proposal_id_type_key" ON "crm_proposal_sections"("proposal_id", "type");

-- CreateIndex
CREATE INDEX "crm_proposals_template_id_idx" ON "crm_proposals"("template_id");

-- CreateIndex
CREATE INDEX "crm_proposals_company_id_idx" ON "crm_proposals"("company_id");

-- CreateIndex
CREATE INDEX "crm_proposals_opportunity_id_idx" ON "crm_proposals"("opportunity_id");

-- AddForeignKey
ALTER TABLE "crm_proposal_templates" ADD CONSTRAINT "crm_proposal_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposal_templates" ADD CONSTRAINT "crm_proposal_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposal_templates" ADD CONSTRAINT "crm_proposal_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposal_template_sections" ADD CONSTRAINT "crm_proposal_template_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "crm_proposal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "crm_proposal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposal_sections" ADD CONSTRAINT "crm_proposal_sections_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "crm_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
