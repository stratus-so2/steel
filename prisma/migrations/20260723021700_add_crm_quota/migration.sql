-- CreateEnum
CREATE TYPE "CrmQuotaPeriod" AS ENUM ('MONTH', 'QUARTER');

-- CreateTable
CREATE TABLE "crm_quotas" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "period" "CrmQuotaPeriod" NOT NULL,
    "period_key" TEXT NOT NULL,
    "target_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_quotas_workspace_id_idx" ON "crm_quotas"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_quotas_workspace_id_period_period_key_idx" ON "crm_quotas"("workspace_id", "period", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "crm_quotas_workspace_id_owner_id_period_period_key_key" ON "crm_quotas"("workspace_id", "owner_id", "period", "period_key");

-- AddForeignKey
ALTER TABLE "crm_quotas" ADD CONSTRAINT "crm_quotas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_quotas" ADD CONSTRAINT "crm_quotas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_quotas" ADD CONSTRAINT "crm_quotas_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_quotas" ADD CONSTRAINT "crm_quotas_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
