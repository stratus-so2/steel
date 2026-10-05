-- CreateEnum
CREATE TYPE "CrmSocialPostFormat" AS ENUM ('IMAGE', 'CAROUSEL', 'VIDEO', 'REELS', 'SHORT');

-- CreateTable
CREATE TABLE "crm_competitor_posts" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "format" "CrmSocialPostFormat" NOT NULL,
    "caption" TEXT,
    "permalink" TEXT,
    "like_count" INTEGER,
    "comments_count" INTEGER,
    "view_count" INTEGER,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_competitor_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_social_connection_posts" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "format" "CrmSocialPostFormat" NOT NULL,
    "caption" TEXT,
    "permalink" TEXT,
    "like_count" INTEGER,
    "comments_count" INTEGER,
    "view_count" INTEGER,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_social_connection_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_competitor_idea_sets" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "ideas" JSONB NOT NULL,
    "model_key" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_competitor_idea_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_competitor_posts_competitor_id_published_at_idx" ON "crm_competitor_posts"("competitor_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_competitor_posts_competitor_id_external_id_key" ON "crm_competitor_posts"("competitor_id", "external_id");

-- CreateIndex
CREATE INDEX "crm_social_connection_posts_connection_id_published_at_idx" ON "crm_social_connection_posts"("connection_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_social_connection_posts_connection_id_external_id_key" ON "crm_social_connection_posts"("connection_id", "external_id");

-- CreateIndex
CREATE INDEX "crm_competitor_idea_sets_competitor_id_created_at_idx" ON "crm_competitor_idea_sets"("competitor_id", "created_at");

-- AddForeignKey
ALTER TABLE "crm_competitor_posts" ADD CONSTRAINT "crm_competitor_posts_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "crm_tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_social_connection_posts" ADD CONSTRAINT "crm_social_connection_posts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "crm_social_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_competitor_idea_sets" ADD CONSTRAINT "crm_competitor_idea_sets_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "crm_tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_competitor_idea_sets" ADD CONSTRAINT "crm_competitor_idea_sets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
