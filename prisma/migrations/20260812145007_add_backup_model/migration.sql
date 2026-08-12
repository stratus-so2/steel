-- CreateEnum
CREATE TYPE "backup_scope" AS ENUM ('FULL', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "backup_status" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "scope" "backup_scope" NOT NULL,
    "workspace_id" TEXT,
    "status" "backup_status" NOT NULL DEFAULT 'RUNNING',
    "storage_key" TEXT,
    "size_bytes" INTEGER,
    "checksum" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backups_scope_started_at_idx" ON "backups"("scope", "started_at");

-- CreateIndex
CREATE INDEX "backups_workspace_id_idx" ON "backups"("workspace_id");

-- CreateIndex
CREATE INDEX "backups_expires_at_idx" ON "backups"("expires_at");

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
