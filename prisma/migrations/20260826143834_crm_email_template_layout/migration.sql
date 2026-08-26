-- AlterTable
ALTER TABLE "crm_email_templates" ADD COLUMN     "template_id" TEXT,
ADD COLUMN     "template_props" JSONB;
