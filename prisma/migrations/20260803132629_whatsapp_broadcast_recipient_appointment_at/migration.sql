-- AlterTable
ALTER TABLE "whatsapp_broadcast_recipients" ADD COLUMN     "appointment_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "whatsapp_broadcast_recipients_contact_id_appointment_at_idx" ON "whatsapp_broadcast_recipients"("contact_id", "appointment_at");
