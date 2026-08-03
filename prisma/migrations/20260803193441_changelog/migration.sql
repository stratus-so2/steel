-- CreateEnum
CREATE TYPE "ChangelogStatus" AS ENUM ('DRAFT', 'QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ChangelogRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "changelogs" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ChangelogStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changelogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changelog_items" (
    "id" TEXT NOT NULL,
    "changelog_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "changelog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changelog_recipients" (
    "id" TEXT NOT NULL,
    "changelog_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" TEXT,
    "status" "ChangelogRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changelog_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changelogs_status_idx" ON "changelogs"("status");

-- CreateIndex
CREATE INDEX "changelog_items_changelog_id_position_idx" ON "changelog_items"("changelog_id", "position");

-- CreateIndex
CREATE INDEX "changelog_recipients_changelog_id_status_idx" ON "changelog_recipients"("changelog_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "changelog_recipients_changelog_id_email_key" ON "changelog_recipients"("changelog_id", "email");

-- AddForeignKey
ALTER TABLE "changelogs" ADD CONSTRAINT "changelogs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changelog_items" ADD CONSTRAINT "changelog_items_changelog_id_fkey" FOREIGN KEY ("changelog_id") REFERENCES "changelogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changelog_recipients" ADD CONSTRAINT "changelog_recipients_changelog_id_fkey" FOREIGN KEY ("changelog_id") REFERENCES "changelogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changelog_recipients" ADD CONSTRAINT "changelog_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
