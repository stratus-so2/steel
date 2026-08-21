-- CreateEnum
CREATE TYPE "CrmScheduledMediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CrmScheduledPostStatus" ADD VALUE 'PUBLISHING';
ALTER TYPE "CrmScheduledPostStatus" ADD VALUE 'PARTIALLY_FAILED';
ALTER TYPE "CrmScheduledPostStatus" ADD VALUE 'CANCELED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CrmScheduledPostTargetStatus" ADD VALUE 'PUBLISHING';
ALTER TYPE "CrmScheduledPostTargetStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "crm_scheduled_post_targets" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "external_post_id" TEXT;

-- AlterTable
ALTER TABLE "crm_scheduled_posts" ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "options" JSONB;

-- CreateTable
CREATE TABLE "crm_scheduled_post_media" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "kind" "CrmScheduledMediaKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_scheduled_post_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_scheduled_post_media_post_id_idx" ON "crm_scheduled_post_media"("post_id");

-- AddForeignKey
ALTER TABLE "crm_scheduled_post_media" ADD CONSTRAINT "crm_scheduled_post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "crm_scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
