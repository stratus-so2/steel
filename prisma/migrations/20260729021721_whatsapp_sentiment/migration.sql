-- CreateEnum
CREATE TYPE "WhatsAppSentiment" AS ENUM ('NEGATIVE', 'NEUTRAL', 'POSITIVE');

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "avg_sentiment_score" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "sentiment" "WhatsAppSentiment",
ADD COLUMN     "sentiment_score" DOUBLE PRECISION;
