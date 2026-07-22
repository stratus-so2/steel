-- AlterEnum
ALTER TYPE "WhatsAppMessageType" ADD VALUE 'CONTACT';

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "contact_payload" JSONB,
ADD COLUMN     "deleted_at" TIMESTAMP(3);
