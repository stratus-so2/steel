-- CreateEnum
CREATE TYPE "CrmEmailTemplateKind" AS ENUM ('LEGACY', 'BUILDER');

-- AlterTable
ALTER TABLE "crm_email_campaigns" ADD COLUMN     "campaign_link" TEXT,
ADD COLUMN     "content_text" TEXT,
ADD COLUMN     "template_id" TEXT;

-- AlterTable
ALTER TABLE "crm_email_templates" ADD COLUMN     "builder_document" JSONB,
ADD COLUMN     "content_text" TEXT,
ADD COLUMN     "kind" "CrmEmailTemplateKind" NOT NULL DEFAULT 'LEGACY';

-- CreateTable
CREATE TABLE "crm_email_brands" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL DEFAULT '',
    "primary_color" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_email_brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_email_brands_workspace_id_key" ON "crm_email_brands"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_email_campaigns_template_id_idx" ON "crm_email_campaigns"("template_id");

-- AddForeignKey
ALTER TABLE "crm_email_brands" ADD CONSTRAINT "crm_email_brands_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_email_campaigns" ADD CONSTRAINT "crm_email_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "crm_email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
