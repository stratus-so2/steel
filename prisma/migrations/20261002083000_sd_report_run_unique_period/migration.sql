-- A trava de idempotência do relatório agendado passa a ser do banco: um
-- relatório por período. Execução sob demanda tem `report_id` nulo e, como
-- NULL não conflita em índice único no Postgres, segue podendo repetir.
-- DropIndex
DROP INDEX "sd_report_runs_report_id_period_start_idx";

-- CreateIndex
CREATE UNIQUE INDEX "sd_report_runs_report_id_period_start_key" ON "sd_report_runs"("report_id", "period_start");
