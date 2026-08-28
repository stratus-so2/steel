/*
  Warnings:

  - You are about to drop the column `html` on the `crm_landing_pages` table. All the data in the column will be lost.
  - You are about to drop the `crm_landing_page_messages` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `template_key` to the `crm_landing_pages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CrmLandingPageSectionType" AS ENUM ('HEADER', 'HERO', 'SERVICES', 'FACTS', 'ABOUT', 'TESTIMONIAL', 'FEATURES', 'WORKS', 'FOOTER');

-- DropForeignKey
ALTER TABLE "crm_landing_page_messages" DROP CONSTRAINT "crm_landing_page_messages_landing_page_id_fkey";

-- AlterTable
ALTER TABLE "crm_landing_pages" DROP COLUMN "html",
ADD COLUMN     "template_key" TEXT NOT NULL;

-- DropTable
DROP TABLE "crm_landing_page_messages";

-- DropEnum
DROP TYPE "CrmLandingPageMessageRole";

-- CreateTable
CREATE TABLE "crm_landing_page_sections" (
    "id" TEXT NOT NULL,
    "landing_page_id" TEXT NOT NULL,
    "type" "CrmLandingPageSectionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_landing_page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_landing_page_sections_landing_page_id_idx" ON "crm_landing_page_sections"("landing_page_id");

-- AddForeignKey
ALTER TABLE "crm_landing_page_sections" ADD CONSTRAINT "crm_landing_page_sections_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "crm_landing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
