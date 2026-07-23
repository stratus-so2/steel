-- CreateEnum
CREATE TYPE "CrmWidgetType" AS ENUM ('CHART', 'VIEW', 'IFRAME', 'RICH_TEXT');

-- CreateTable
CREATE TABLE "crm_reports" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "group_by" TEXT,
    "sort" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_dashboards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_dashboard_widgets" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "type" "CrmWidgetType" NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "w" INTEGER NOT NULL DEFAULT 4,
    "h" INTEGER NOT NULL DEFAULT 6,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_reports_workspace_id_idx" ON "crm_reports"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_reports_deleted_at_idx" ON "crm_reports"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_reports_workspace_id_position_idx" ON "crm_reports"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_dashboards_workspace_id_idx" ON "crm_dashboards"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_dashboards_deleted_at_idx" ON "crm_dashboards"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_dashboards_workspace_id_position_idx" ON "crm_dashboards"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_dashboard_widgets_dashboard_id_idx" ON "crm_dashboard_widgets"("dashboard_id");

-- AddForeignKey
ALTER TABLE "crm_reports" ADD CONSTRAINT "crm_reports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reports" ADD CONSTRAINT "crm_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reports" ADD CONSTRAINT "crm_reports_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboards" ADD CONSTRAINT "crm_dashboards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboards" ADD CONSTRAINT "crm_dashboards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboards" ADD CONSTRAINT "crm_dashboards_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_dashboard_widgets" ADD CONSTRAINT "crm_dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "crm_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
