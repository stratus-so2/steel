-- AlterTable
ALTER TABLE "crm_dashboards" ADD COLUMN     "module" "ModuleKind" NOT NULL DEFAULT 'CRM';

-- AlterTable
ALTER TABLE "crm_reports" ADD COLUMN     "module" "ModuleKind" NOT NULL DEFAULT 'CRM';

-- CreateIndex
CREATE INDEX "crm_dashboards_workspace_id_module_idx" ON "crm_dashboards"("workspace_id", "module");

-- CreateIndex
CREATE INDEX "crm_reports_workspace_id_module_idx" ON "crm_reports"("workspace_id", "module");
