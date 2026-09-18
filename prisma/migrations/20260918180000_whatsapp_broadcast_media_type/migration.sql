-- CreateEnum
CREATE TYPE "WhatsAppBroadcastMediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- AlterTable
ALTER TABLE "whatsapp_broadcast_lists" ADD COLUMN     "media_file_name" TEXT,
ADD COLUMN     "media_mime_type" TEXT,
ADD COLUMN     "media_type" "WhatsAppBroadcastMediaType";

