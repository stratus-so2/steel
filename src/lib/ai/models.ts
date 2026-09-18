/**
 * Catálogo de provedores/modelos de IA oferecidos pela plataforma. Módulo
 * isomórfico (sem SDK, sem env) — importado pelo schema Zod, pelos services
 * e pela UI de ajustes. Um modelo é identificado por uma `AiModelKey` no
 * formato `"<provider>:<model>"`, que é o valor persistido no banco.
 */
export const AI_PROVIDERS = ['openai', 'anthropic'] as const
export type AiProviderId = (typeof AI_PROVIDERS)[number]

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
}

/** Funcionalidades de produto que consomem IA. */
export const AI_FEATURES = [
  'CRM_ASSISTANT',
  'WHATSAPP_REPLY',
  'WHATSAPP_SENTIMENT',
] as const
export type AiFeature = (typeof AI_FEATURES)[number]

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  CRM_ASSISTANT: 'Assistente de IA do CRM',
  WHATSAPP_REPLY: 'Resposta automática do WhatsApp',
  WHATSAPP_SENTIMENT: 'Análise de sentimento do WhatsApp',
}

export interface AiModelDefinition {
  key: string
  provider: AiProviderId
  model: string
  label: string
}

export const AI_MODEL_CATALOG = [
  {
    key: 'openai:gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    label: 'GPT-4o mini',
  },
  {
    key: 'openai:gpt-4.1-mini',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
  },
  {
    key: 'openai:gpt-5-mini',
    provider: 'openai',
    model: 'gpt-5-mini',
    label: 'GPT-5 mini',
  },
  { key: 'openai:gpt-5', provider: 'openai', model: 'gpt-5', label: 'GPT-5' },
  {
    key: 'anthropic:claude-haiku-4-5',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
  },
  {
    key: 'anthropic:claude-sonnet-5',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
  },
  {
    key: 'anthropic:claude-opus-5',
    provider: 'anthropic',
    model: 'claude-opus-5',
    label: 'Claude Opus 5',
  },
] as const satisfies readonly AiModelDefinition[]

export type AiModelKey = (typeof AI_MODEL_CATALOG)[number]['key']

export const AI_MODEL_KEYS = AI_MODEL_CATALOG.map((m) => m.key) as [
  AiModelKey,
  ...AiModelKey[],
]

/**
 * Padrão da plataforma: mantém o comportamento anterior (tudo em
 * `gpt-4o-mini`) para workspaces que ainda não configuraram a IA.
 */
export const DEFAULT_AI_MODEL_KEY: AiModelKey = 'openai:gpt-4o-mini'

/** Regra de custo definida pelo produto: 1000 tokens = US$ 4,00. */
export const DEFAULT_USD_PER_1K_TOKENS = 4

/**
 * Cota mensal padrão por workspace: US$ 50,00 (= 12.500 tokens na regra
 * acima). O admin do workspace pode alterar em Ajustes > Steel IA.
 */
export const DEFAULT_MONTHLY_QUOTA_USD = 50

/** Teto aceito para a cota configurável (evita valores absurdos por engano). */
export const MAX_MONTHLY_QUOTA_USD = 1_000_000

const CATALOG_BY_KEY = new Map<string, AiModelDefinition>(
  AI_MODEL_CATALOG.map((m) => [m.key, m]),
)

export function findAiModel(key: string): AiModelDefinition | undefined {
  return CATALOG_BY_KEY.get(key)
}

export function isAiModelKey(key: string): key is AiModelKey {
  return CATALOG_BY_KEY.has(key)
}
