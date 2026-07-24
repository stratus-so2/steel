-- AlterEnum
BEGIN;
CREATE TYPE "CrmSocialConnectionStatus_new" AS ENUM ('CONNECTED', 'EXPIRED', 'REVOKED');
ALTER TABLE "public"."crm_social_connections" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "crm_social_connections" ALTER COLUMN "status" TYPE "CrmSocialConnectionStatus_new" USING ("status"::text::"CrmSocialConnectionStatus_new");
ALTER TYPE "CrmSocialConnectionStatus" RENAME TO "CrmSocialConnectionStatus_old";
ALTER TYPE "CrmSocialConnectionStatus_new" RENAME TO "CrmSocialConnectionStatus";
DROP TYPE "public"."CrmSocialConnectionStatus_old";
ALTER TABLE "crm_social_connections" ALTER COLUMN "status" SET DEFAULT 'CONNECTED';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CrmSocialPlatform" ADD VALUE 'GOOGLE_ANALYTICS';
ALTER TYPE "CrmSocialPlatform" ADD VALUE 'GOOGLE_ADS';

-- AlterTable
ALTER TABLE "crm_social_connections" ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "token_expires_at" TIMESTAMP(3);

