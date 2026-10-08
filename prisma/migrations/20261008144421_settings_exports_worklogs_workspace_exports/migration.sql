-- CreateEnum
CREATE TYPE "WorkspaceExportKind" AS ENUM ('DATA', 'LOGS');

-- CreateEnum
CREATE TYPE "WorkspaceExportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "workspace_exports" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "WorkspaceExportKind" NOT NULL,
    "status" "WorkspaceExportStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT,
    "day_key" TEXT,
    "period_from" TIMESTAMP(3),
    "period_to" TIMESTAMP(3),
    "storage_key" TEXT,
    "file_name" TEXT,
    "size_bytes" BIGINT,
    "item_count" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "workspace_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_exports_workspace_id_created_at_idx" ON "workspace_exports"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "workspace_exports_status_expires_at_idx" ON "workspace_exports"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_exports_workspace_id_kind_day_key_key" ON "workspace_exports"("workspace_id", "kind", "day_key");

-- AddForeignKey
ALTER TABLE "workspace_exports" ADD CONSTRAINT "workspace_exports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_exports" ADD CONSTRAINT "workspace_exports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
