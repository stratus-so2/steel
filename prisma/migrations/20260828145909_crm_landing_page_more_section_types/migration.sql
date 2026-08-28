-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CrmLandingPageSectionType" ADD VALUE 'PRICING';
ALTER TYPE "CrmLandingPageSectionType" ADD VALUE 'FAQ';
ALTER TYPE "CrmLandingPageSectionType" ADD VALUE 'STEPS';
ALTER TYPE "CrmLandingPageSectionType" ADD VALUE 'NEWSLETTER';
ALTER TYPE "CrmLandingPageSectionType" ADD VALUE 'LOGOS';
ALTER TYPE "CrmLandingPageSectionType" ADD VALUE 'PRODUCTS';
