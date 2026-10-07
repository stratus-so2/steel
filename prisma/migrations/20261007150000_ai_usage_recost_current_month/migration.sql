-- Data migration (ai-usage slice): re-price the current UTC month's AI usage
-- with the real per-model cost (ADR 0019), so the quota of this month stops
-- counting the old fixed rule (1,000 tokens = US$ 4.00, or the workspace's
-- own `usd_per_1k_tokens`).
--
-- Safety:
-- * Only rows created in the current UTC month (the quota period) are
--   touched; earlier months keep the price they were charged with.
-- * Only rows whose `cost_usd` still equals the legacy formula
--   round((input + output) / 1000 x usd_per_1k_tokens, 6) are re-priced, so
--   rows already priced by ADR 0019 stay as they are and running the
--   statement again changes nothing (idempotent).
-- * Prices are frozen here (US$ per 1M tokens, AI_MODEL_CATALOG as of
--   2026-10-07). Cached-input tokens were never stored, so legacy rows pay
--   the full input price (never under-charges). A model outside this table
--   pays the most expensive price (Claude Opus 5), like FALLBACK_AI_MODEL_PRICING.
-- * The platform margin (`platform_ai_settings.cost_margin`, default 1) is
--   applied, as in AiUsageService.record.
UPDATE "ai_usage" AS u
SET "cost_usd" = r.new_cost
FROM (
  SELECT
    a."id",
    round(
      (
        a."input_tokens"::numeric * coalesce(p.input_per_1m, 5)
        + a."output_tokens"::numeric * coalesce(p.output_per_1m, 25)
      ) / 1000000 * m.margin,
      6
    ) AS new_cost
  FROM "ai_usage" AS a
  LEFT JOIN "workspace_ai_settings" AS s ON s."workspace_id" = a."workspace_id"
  LEFT JOIN (
    VALUES
      ('openai', 'gpt-4o-mini', 0.15::numeric, 0.6::numeric),
      ('openai', 'gpt-4.1-mini', 0.4, 1.6),
      ('openai', 'gpt-5-mini', 0.25, 2),
      ('openai', 'gpt-5', 1.25, 10),
      ('anthropic', 'claude-haiku-4-5', 1, 5),
      ('anthropic', 'claude-sonnet-5', 2, 10),
      ('anthropic', 'claude-opus-5', 5, 25)
  ) AS p (provider, model, input_per_1m, output_per_1m)
    ON p.provider = a."provider" AND p.model = a."model"
  CROSS JOIN (
    SELECT coalesce(
      (SELECT "cost_margin" FROM "platform_ai_settings" WHERE "id" = 'default'),
      1
    ) AS margin
  ) AS m
  WHERE a."created_at" >= date_trunc('month', now() AT TIME ZONE 'UTC')
    AND a."cost_usd" = round(
      (a."input_tokens" + a."output_tokens")::numeric
        * coalesce(s."usd_per_1k_tokens", 4) / 1000,
      6
    )
    AND (a."input_tokens" + a."output_tokens") > 0
) AS r
WHERE u."id" = r."id";
