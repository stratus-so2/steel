-- CreateEnum
CREATE TYPE "SdReportKind" AS ENUM ('SLA');

-- CreateEnum
CREATE TYPE "SdReportFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "SdReportPeriod" AS ENUM ('LAST_MONTH', 'LAST_WEEK', 'CURRENT_MONTH', 'LAST_30_DAYS', 'LAST_90_DAYS');

-- CreateEnum
CREATE TYPE "SdReportRunStatus" AS ENUM ('GENERATED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SdKbReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "SdRiskLevelPrediction" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SdIntegrationKind" AS ENUM ('SLACK', 'GITHUB');

-- CreateEnum
CREATE TYPE "SdIntegrationStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "SdIntegrationLinkKind" AS ENUM ('SLACK_THREAD', 'GITHUB_ISSUE', 'GITHUB_PULL_REQUEST');

-- AlterEnum
ALTER TYPE "SdKbArticleStatus" ADD VALUE 'IN_REVIEW';

-- AlterTable
ALTER TABLE "sd_kb_articles" ADD COLUMN     "last_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reuse_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "review_due_at" TIMESTAMP(3),
ADD COLUMN     "review_interval_days" INTEGER,
ADD COLUMN     "source_ticket_id" TEXT;

-- AlterTable
ALTER TABLE "sd_ticket_kb_links" ADD COLUMN     "resolved_ticket" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sd_scheduled_reports" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SdReportKind" NOT NULL DEFAULT 'SLA',
    "customer_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "department_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticket_types" "SdTicketType"[] DEFAULT ARRAY[]::"SdTicketType"[],
    "period" "SdReportPeriod" NOT NULL DEFAULT 'LAST_MONTH',
    "formats" "SdReportFormat"[] DEFAULT ARRAY['PDF', 'CSV']::"SdReportFormat"[],
    "day_of_month" INTEGER NOT NULL DEFAULT 1,
    "at_time" TEXT NOT NULL DEFAULT '07:00',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "include_account_owners" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_report_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "report_id" TEXT,
    "kind" "SdReportKind" NOT NULL DEFAULT 'SLA',
    "status" "SdReportRunStatus" NOT NULL DEFAULT 'GENERATED',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "summary" JSONB,
    "pdf_key" TEXT,
    "csv_key" TEXT,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "requested_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_kb_reviews" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "status" "SdKbReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_kb_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_ticket_risk_predictions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "level" "SdRiskLevelPrediction" NOT NULL DEFAULT 'LOW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "factors" JSONB NOT NULL DEFAULT '[]',
    "breach_eta_at" TIMESTAMP(3),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sd_ticket_risk_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_incident_clusters" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ticket_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticket_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "problem_ticket_id" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_incident_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_integrations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "SdIntegrationKind" NOT NULL,
    "status" "SdIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_error" TEXT,
    "external_id" TEXT NOT NULL,
    "external_name" TEXT,
    "encrypted_token" TEXT NOT NULL,
    "encrypted_signing_secret" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sd_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sd_integration_links" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "kind" "SdIntegrationLinkKind" NOT NULL,
    "external_key" TEXT NOT NULL,
    "external_url" TEXT,
    "external_state" TEXT,
    "meta" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sd_integration_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sd_scheduled_reports_workspace_id_active_next_run_at_idx" ON "sd_scheduled_reports"("workspace_id", "active", "next_run_at");

-- CreateIndex
CREATE INDEX "sd_report_runs_workspace_id_created_at_idx" ON "sd_report_runs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "sd_report_runs_report_id_period_start_idx" ON "sd_report_runs"("report_id", "period_start");

-- CreateIndex
CREATE INDEX "sd_kb_reviews_article_id_created_at_idx" ON "sd_kb_reviews"("article_id", "created_at");

-- CreateIndex
CREATE INDEX "sd_kb_reviews_workspace_id_status_idx" ON "sd_kb_reviews"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sd_ticket_risk_predictions_ticket_id_key" ON "sd_ticket_risk_predictions"("ticket_id");

-- CreateIndex
CREATE INDEX "sd_ticket_risk_predictions_workspace_id_level_score_idx" ON "sd_ticket_risk_predictions"("workspace_id", "level", "score");

-- CreateIndex
CREATE INDEX "sd_incident_clusters_workspace_id_last_seen_at_idx" ON "sd_incident_clusters"("workspace_id", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "sd_incident_clusters_workspace_id_signature_key" ON "sd_incident_clusters"("workspace_id", "signature");

-- CreateIndex
CREATE INDEX "sd_integrations_workspace_id_kind_idx" ON "sd_integrations"("workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sd_integrations_workspace_id_kind_external_id_key" ON "sd_integrations"("workspace_id", "kind", "external_id");

-- CreateIndex
CREATE INDEX "sd_integration_links_ticket_id_idx" ON "sd_integration_links"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "sd_integration_links_integration_id_kind_external_key_key" ON "sd_integration_links"("integration_id", "kind", "external_key");

-- CreateIndex
CREATE INDEX "sd_kb_articles_workspace_id_review_due_at_idx" ON "sd_kb_articles"("workspace_id", "review_due_at");

-- AddForeignKey
ALTER TABLE "sd_kb_articles" ADD CONSTRAINT "sd_kb_articles_source_ticket_id_fkey" FOREIGN KEY ("source_ticket_id") REFERENCES "sd_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_scheduled_reports" ADD CONSTRAINT "sd_scheduled_reports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_scheduled_reports" ADD CONSTRAINT "sd_scheduled_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_report_runs" ADD CONSTRAINT "sd_report_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_report_runs" ADD CONSTRAINT "sd_report_runs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "sd_scheduled_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_report_runs" ADD CONSTRAINT "sd_report_runs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_reviews" ADD CONSTRAINT "sd_kb_reviews_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_reviews" ADD CONSTRAINT "sd_kb_reviews_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "sd_kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_kb_reviews" ADD CONSTRAINT "sd_kb_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_risk_predictions" ADD CONSTRAINT "sd_ticket_risk_predictions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_ticket_risk_predictions" ADD CONSTRAINT "sd_ticket_risk_predictions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_incident_clusters" ADD CONSTRAINT "sd_incident_clusters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_incident_clusters" ADD CONSTRAINT "sd_incident_clusters_dismissed_by_id_fkey" FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_integrations" ADD CONSTRAINT "sd_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_integrations" ADD CONSTRAINT "sd_integrations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_integration_links" ADD CONSTRAINT "sd_integration_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_integration_links" ADD CONSTRAINT "sd_integration_links_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sd_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_integration_links" ADD CONSTRAINT "sd_integration_links_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sd_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sd_integration_links" ADD CONSTRAINT "sd_integration_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
