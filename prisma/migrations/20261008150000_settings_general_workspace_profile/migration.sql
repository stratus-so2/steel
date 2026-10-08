-- CreateEnum
CREATE TYPE "workspace_company_size" AS ENUM ('SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_201_1000', 'SIZE_1000_PLUS');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "company_size" "workspace_company_size",
ADD COLUMN     "logo_url" TEXT;
