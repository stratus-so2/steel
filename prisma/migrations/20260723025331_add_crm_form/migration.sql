-- CreateEnum
CREATE TYPE "CrmFormStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CrmFormAction" AS ENUM ('COMPANY', 'PERSON', 'LEAD');

-- CreateTable
CREATE TABLE "crm_forms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmFormStatus" NOT NULL DEFAULT 'DRAFT',
    "public_token" TEXT NOT NULL,
    "action" "CrmFormAction" NOT NULL DEFAULT 'LEAD',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "success_message" TEXT,
    "redirect_url" TEXT,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_form_submissions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "action" "CrmFormAction" NOT NULL,
    "created_person_id" TEXT,
    "created_company_id" TEXT,
    "created_lead_id" TEXT,
    "ip_hash" TEXT,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_forms_public_token_key" ON "crm_forms"("public_token");

-- CreateIndex
CREATE INDEX "crm_forms_workspace_id_idx" ON "crm_forms"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_forms_deleted_at_idx" ON "crm_forms"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_forms_workspace_id_position_idx" ON "crm_forms"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_form_submissions_form_id_idx" ON "crm_form_submissions"("form_id");

-- AddForeignKey
ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "crm_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
