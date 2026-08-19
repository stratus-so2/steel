-- CreateEnum
CREATE TYPE "CrmCompetitorSyncStatus" AS ENUM ('MANUAL', 'SYNCED', 'SYNC_FAILED');

-- AlterTable
ALTER TABLE "crm_tracked_competitors" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "last_synced_at" TIMESTAMP(3),
ADD COLUMN     "sync_status" "CrmCompetitorSyncStatus" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "crm_social_connection_metric_snapshots" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "followers_count" INTEGER NOT NULL,
    "posts_count" INTEGER,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_social_connection_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_competitor_metric_snapshots" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "followers_count" INTEGER NOT NULL,
    "posts_count" INTEGER,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_competitor_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_social_connection_metric_snapshots_connection_id_captur_idx" ON "crm_social_connection_metric_snapshots"("connection_id", "captured_at");

-- CreateIndex
CREATE INDEX "crm_competitor_metric_snapshots_competitor_id_captured_at_idx" ON "crm_competitor_metric_snapshots"("competitor_id", "captured_at");

-- AddForeignKey
ALTER TABLE "crm_social_connection_metric_snapshots" ADD CONSTRAINT "crm_social_connection_metric_snapshots_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "crm_social_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_competitor_metric_snapshots" ADD CONSTRAINT "crm_competitor_metric_snapshots_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "crm_tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
