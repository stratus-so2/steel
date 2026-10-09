-- CreateEnum
CREATE TYPE "WhiteboardVersionKind" AS ENUM ('AUTO', 'MANUAL', 'RESTORE');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "whiteboard_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "whiteboards" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scene" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "versioned_revision" INTEGER NOT NULL DEFAULT 0,
    "last_version_at" TIMESTAMP(3),
    "thumbnail_at" TIMESTAMP(3),
    "locked_by_id" TEXT,
    "locked_until" TIMESTAMP(3),
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whiteboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whiteboard_versions" (
    "id" TEXT NOT NULL,
    "whiteboard_id" TEXT NOT NULL,
    "kind" "WhiteboardVersionKind" NOT NULL,
    "name" TEXT,
    "scene" JSONB NOT NULL,
    "revision" INTEGER NOT NULL,
    "element_count" INTEGER NOT NULL DEFAULT 0,
    "restored_from_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whiteboard_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whiteboards_workspace_id_archived_at_edited_at_idx" ON "whiteboards"("workspace_id", "archived_at", "edited_at");

-- CreateIndex
CREATE INDEX "whiteboard_versions_whiteboard_id_kind_created_at_idx" ON "whiteboard_versions"("whiteboard_id", "kind", "created_at");

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboard_versions" ADD CONSTRAINT "whiteboard_versions_whiteboard_id_fkey" FOREIGN KEY ("whiteboard_id") REFERENCES "whiteboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboard_versions" ADD CONSTRAINT "whiteboard_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
