-- KCS: validade padrão (em dias) da revisão dos artigos da base, por workspace.
-- O artigo pode sobrescrever em `sd_kb_articles.review_interval_days`.
ALTER TABLE "sd_settings" ADD COLUMN     "kb_review_interval_days" INTEGER NOT NULL DEFAULT 180;
