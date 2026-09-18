-- Validade de propostas: SEM backfill de propósito. Propostas já existentes
-- mantêm `valid_until` como está (em geral NULL), e NULL significa "sem
-- validade" — nenhuma proposta legada, já enviada a um cliente, passa a
-- expirar retroativamente por causa desta migration. A validade padrão
-- (crm_settings.proposal_validity_days, 15 dias) só vale para propostas
-- criadas daqui em diante.

-- AlterTable
ALTER TABLE "crm_proposals" ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "accepted_by_name" TEXT,
ADD COLUMN     "expired_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "crm_lead_reopenings" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "to_stage" "CrmLeadStage" NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_lost_reason" TEXT,
    "previous_lost_note" TEXT,
    "previous_closed_at" TIMESTAMP(3),
    "previous_retry_at" TIMESTAMP(3),
    "reopened_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_reopenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_settings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "lead_reopen_stage" "CrmLeadStage" NOT NULL DEFAULT 'RECEIVED',
    "proposal_validity_days" INTEGER NOT NULL DEFAULT 15,
    "notify_proposal_expiry" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_lead_reopenings_lead_id_created_at_idx" ON "crm_lead_reopenings"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_lead_reopenings_workspace_id_idx" ON "crm_lead_reopenings"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_settings_workspace_id_key" ON "crm_settings"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_proposals_status_valid_until_idx" ON "crm_proposals"("status", "valid_until");

-- AddForeignKey
ALTER TABLE "crm_lead_reopenings" ADD CONSTRAINT "crm_lead_reopenings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_reopenings" ADD CONSTRAINT "crm_lead_reopenings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_reopenings" ADD CONSTRAINT "crm_lead_reopenings_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_settings" ADD CONSTRAINT "crm_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_settings" ADD CONSTRAINT "crm_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
