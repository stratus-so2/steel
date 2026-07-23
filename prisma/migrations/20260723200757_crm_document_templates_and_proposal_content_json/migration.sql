-- AlterTable
ALTER TABLE "crm_proposals" ADD COLUMN     "content_json" TEXT;

-- CreateTable
CREATE TABLE "crm_document_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "content_json" TEXT,
    "type" "CrmDocumentType" NOT NULL DEFAULT 'PROPOSAL',
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_document_templates_workspace_id_idx" ON "crm_document_templates"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_document_templates_type_idx" ON "crm_document_templates"("type");

-- CreateIndex
CREATE INDEX "crm_document_templates_deleted_at_idx" ON "crm_document_templates"("deleted_at");

-- AddForeignKey
ALTER TABLE "crm_document_templates" ADD CONSTRAINT "crm_document_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_document_templates" ADD CONSTRAINT "crm_document_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
