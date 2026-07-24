-- CreateEnum
CREATE TYPE "CrmLandingPageMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "crm_landing_page_messages" (
    "id" TEXT NOT NULL,
    "landing_page_id" TEXT NOT NULL,
    "role" "CrmLandingPageMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_landing_page_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_landing_page_messages_landing_page_id_idx" ON "crm_landing_page_messages"("landing_page_id");

-- AddForeignKey
ALTER TABLE "crm_landing_page_messages" ADD CONSTRAINT "crm_landing_page_messages_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "crm_landing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

