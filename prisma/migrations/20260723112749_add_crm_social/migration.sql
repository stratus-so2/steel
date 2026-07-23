-- CreateEnum
CREATE TYPE "CrmSocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITTER', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "CrmSocialConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "CrmScheduledPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrmScheduledPostTargetStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "crm_social_connections" (
    "id" TEXT NOT NULL,
    "platform" "CrmSocialPlatform" NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "account_name" TEXT,
    "status" "CrmSocialConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_scheduled_posts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "title" TEXT,
    "status" "CrmScheduledPostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_for" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "crm_scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_scheduled_post_targets" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "platform" "CrmSocialPlatform" NOT NULL,
    "status" "CrmScheduledPostTargetStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_scheduled_post_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_social_connections_workspace_id_idx" ON "crm_social_connections"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_social_connections_workspace_id_platform_key" ON "crm_social_connections"("workspace_id", "platform");

-- CreateIndex
CREATE INDEX "crm_scheduled_posts_workspace_id_idx" ON "crm_scheduled_posts"("workspace_id");

-- CreateIndex
CREATE INDEX "crm_scheduled_posts_status_scheduled_for_idx" ON "crm_scheduled_posts"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "crm_scheduled_posts_deleted_at_idx" ON "crm_scheduled_posts"("deleted_at");

-- CreateIndex
CREATE INDEX "crm_scheduled_post_targets_post_id_idx" ON "crm_scheduled_post_targets"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_scheduled_post_targets_post_id_platform_key" ON "crm_scheduled_post_targets"("post_id", "platform");

-- AddForeignKey
ALTER TABLE "crm_social_connections" ADD CONSTRAINT "crm_social_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_social_connections" ADD CONSTRAINT "crm_social_connections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_social_connections" ADD CONSTRAINT "crm_social_connections_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_scheduled_posts" ADD CONSTRAINT "crm_scheduled_posts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_scheduled_posts" ADD CONSTRAINT "crm_scheduled_posts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_scheduled_post_targets" ADD CONSTRAINT "crm_scheduled_post_targets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "crm_scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
