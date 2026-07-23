-- CreateEnum
CREATE TYPE "CrmLandingPageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "crm_landing_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "status" "CrmLandingPageStatus" NOT NULL DEFAULT 'DRAFT',
    "share_token" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_landing_page_views" (
    "id" TEXT NOT NULL,
    "landing_page_id" TEXT NOT NULL,
    "view_id" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "cta_clicks" INTEGER NOT NULL DEFAULT 0,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_landing_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_landing_pages_share_token_key" ON "crm_landing_pages"("share_token");

-- CreateIndex
CREATE INDEX "crm_landing_pages_workspace_id_idx" ON "crm_landing_pages"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_landing_pages_status_idx" ON "crm_landing_pages"("status");

-- CreateIndex
CREATE INDEX "crm_landing_pages_deleted_at_idx" ON "crm_landing_pages"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_landing_pages_workspace_id_position_idx" ON "crm_landing_pages"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "crm_landing_page_views_landing_page_id_idx" ON "crm_landing_page_views"("landing_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_landing_page_views_landing_page_id_view_id_key" ON "crm_landing_page_views"("landing_page_id", "view_id");

-- AddForeignKey
ALTER TABLE "crm_landing_pages" ADD CONSTRAINT "crm_landing_pages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_landing_pages" ADD CONSTRAINT "crm_landing_pages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_landing_pages" ADD CONSTRAINT "crm_landing_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_landing_page_views" ADD CONSTRAINT "crm_landing_page_views_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "crm_landing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
