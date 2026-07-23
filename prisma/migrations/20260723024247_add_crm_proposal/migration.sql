-- CreateEnum
CREATE TYPE "CrmDocumentType" AS ENUM ('PREMISES', 'PORTFOLIO', 'PROPOSAL', 'CONTRACT');

-- CreateEnum
CREATE TYPE "CrmProposalStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "crm_proposals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "type" "CrmDocumentType" NOT NULL DEFAULT 'PROPOSAL',
    "status" "CrmProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "share_token" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_proposal_views" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "view_id" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "reached_end" BOOLEAN NOT NULL DEFAULT false,
    "scrolled_pct" INTEGER NOT NULL DEFAULT 0,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_proposal_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_proposals_share_token_key" ON "crm_proposals"("share_token");

-- CreateIndex
CREATE INDEX "crm_proposals_workspace_id_idx" ON "crm_proposals"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_proposals_status_idx" ON "crm_proposals"("status");

-- CreateIndex
CREATE INDEX "crm_proposals_deleted_at_idx" ON "crm_proposals"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_proposals_workspace_id_position_idx" ON "crm_proposals"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_proposal_views_proposal_id_idx" ON "crm_proposal_views"("proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_proposal_views_proposal_id_view_id_key" ON "crm_proposal_views"("proposal_id", "view_id");

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_proposal_views" ADD CONSTRAINT "crm_proposal_views_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "crm_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
