-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "wiki_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "wiki_pages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "cover_image" TEXT,
    "content" JSONB NOT NULL,
    "yjs_state" BYTEA,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_comments" (
    "id" TEXT NOT NULL,
    "wiki_page_id" TEXT NOT NULL,
    "author_id" TEXT,
    "parent_id" TEXT,
    "mark_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_labels" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_labels" (
    "wiki_page_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_labels_pkey" PRIMARY KEY ("wiki_page_id","label_id")
);

-- CreateIndex
CREATE INDEX "wiki_pages_workspace_id_archived_at_idx" ON "wiki_pages"("workspace_id", "archived_at");

-- CreateIndex
CREATE INDEX "wiki_comments_wiki_page_id_mark_id_idx" ON "wiki_comments"("wiki_page_id", "mark_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_labels_workspace_id_name_key" ON "wiki_labels"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "wiki_page_labels_label_id_idx" ON "wiki_page_labels"("label_id");

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_comments" ADD CONSTRAINT "wiki_comments_wiki_page_id_fkey" FOREIGN KEY ("wiki_page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_comments" ADD CONSTRAINT "wiki_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_comments" ADD CONSTRAINT "wiki_comments_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_comments" ADD CONSTRAINT "wiki_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wiki_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_labels" ADD CONSTRAINT "wiki_labels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_labels" ADD CONSTRAINT "wiki_page_labels_wiki_page_id_fkey" FOREIGN KEY ("wiki_page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_labels" ADD CONSTRAINT "wiki_page_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "wiki_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
