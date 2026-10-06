-- AlterTable
ALTER TABLE "ai_action_logs" ADD COLUMN     "summary" TEXT;

-- CreateTable
CREATE TABLE "platform_ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cost_margin" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ai_settings_pkey" PRIMARY KEY ("id")
);

-- Backfill: rows written before this migration stored the pt-BR summary in
-- "outcome". Copy it to "summary" and normalize "outcome" to success/failure
-- (failed executions always had "error" set). Nothing is dropped.
UPDATE "ai_action_logs"
SET "summary" = CASE WHEN "error" IS NULL THEN "outcome" ELSE NULL END,
    "outcome" = CASE WHEN "error" IS NULL THEN 'success' ELSE 'failure' END
WHERE "outcome" NOT IN ('success', 'failure');
