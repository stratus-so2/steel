-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "file_bytes" BIGINT,
ADD COLUMN     "file_count" INTEGER,
ADD COLUMN     "files_key" TEXT;
