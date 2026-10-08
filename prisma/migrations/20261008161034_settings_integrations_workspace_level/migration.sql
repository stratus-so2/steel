-- settings-integrations (ADR 0024): Slack/GitHub connections move from the
-- ServiceDesk (`sd_integrations`) to the workspace (`workspace_integrations`),
-- shared by every module, and GitLab joins as a third provider.
--
-- Additive: `sd_integrations` is NOT dropped nor changed. Its rows are copied
-- with the SAME ids, so `sd_integration_links.integration_id` keeps pointing
-- at the same connection and only its foreign key is re-targeted. The JSON
-- `config` is copied verbatim; the app maps the legacy ServiceDesk shape on
-- read (`src/lib/integrations/config.ts`) and saves the new shape on the next
-- write.
--
-- Rollback (docs/adr/0024-workspace-level-integrations.md):
--   ALTER TABLE "sd_integration_links" DROP CONSTRAINT "sd_integration_links_integration_id_fkey";
--   DELETE FROM "sd_integration_links" l WHERE NOT EXISTS
--     (SELECT 1 FROM "sd_integrations" s WHERE s.id = l.integration_id);  -- GitLab/new links
--   ALTER TABLE "sd_integration_links" ADD CONSTRAINT "sd_integration_links_integration_id_fkey"
--     FOREIGN KEY ("integration_id") REFERENCES "sd_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
--   DROP TABLE "workspace_integrations"; DROP TYPE "workspace_integration_kind"; DROP TYPE "workspace_integration_status";
-- (the two GITLAB_* values stay in "SdIntegrationLinkKind": Postgres cannot drop enum values and they are harmless).

-- CreateEnum
CREATE TYPE "workspace_integration_kind" AS ENUM ('SLACK', 'GITHUB', 'GITLAB');

-- CreateEnum
CREATE TYPE "workspace_integration_status" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SdIntegrationLinkKind" ADD VALUE 'GITLAB_ISSUE';
ALTER TYPE "SdIntegrationLinkKind" ADD VALUE 'GITLAB_MERGE_REQUEST';

-- DropForeignKey
ALTER TABLE "sd_integration_links" DROP CONSTRAINT "sd_integration_links_integration_id_fkey";

-- CreateTable
CREATE TABLE "workspace_integrations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "workspace_integration_kind" NOT NULL,
    "status" "workspace_integration_status" NOT NULL DEFAULT 'ACTIVE',
    "status_error" TEXT,
    "external_id" TEXT NOT NULL,
    "external_name" TEXT,
    "base_url" TEXT,
    "encrypted_token" TEXT NOT NULL,
    "encrypted_signing_secret" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_event_at" TIMESTAMP(3),
    "last_event_type" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_integrations_workspace_id_kind_idx" ON "workspace_integrations"("workspace_id", "kind");

-- CreateIndex
CREATE INDEX "workspace_integrations_kind_external_id_idx" ON "workspace_integrations"("kind", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_integrations_workspace_id_kind_external_id_key" ON "workspace_integrations"("workspace_id", "kind", "external_id");

-- Copy the ServiceDesk connections (same ids, config verbatim).
INSERT INTO "workspace_integrations" (
    "id", "workspace_id", "kind", "status", "status_error", "external_id",
    "external_name", "base_url", "encrypted_token", "encrypted_signing_secret",
    "config", "created_by_id", "created_at", "updated_at", "deleted_at"
)
SELECT
    "id", "workspace_id", "kind"::text::"workspace_integration_kind",
    "status"::text::"workspace_integration_status", "status_error", "external_id",
    "external_name", NULL, "encrypted_token", "encrypted_signing_secret",
    "config", "created_by_id", "created_at", "updated_at", "deleted_at"
FROM "sd_integrations";

-- AddForeignKey
ALTER TABLE "sd_integration_links" ADD CONSTRAINT "sd_integration_links_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "workspace_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
