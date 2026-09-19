import { NEXT_PUBLIC_AXIOM_DATASET, NODE_ENV } from '@/lib/env/env'
import {
  ANALYTICS_FIXTURES,
  AXIOM_QUERY_TOKEN,
  AXIOM_QUERY_URL,
} from '@/lib/env/server'
import type { AnalyticsSource } from '@/src/schemas/admin-analytics.schema'

export const DEFAULT_AXIOM_QUERY_URL = 'https://api.axiom.co'

export interface AnalyticsConfig {
  source: AnalyticsSource
  token?: string
  url: string
  dataset: string
}

/**
 * De onde vêm os dados do painel Analytics:
 * - `fixtures` — `ANALYTICS_FIXTURES=true` fora de produção (dados simulados);
 * - `axiom` — com `AXIOM_QUERY_TOKEN`;
 * - `unconfigured` — nenhum dos dois (a página mostra o passo a passo).
 * Em produção as fixtures nunca valem, mesmo com a flag.
 */
export function resolveAnalyticsConfig(
  env: {
    nodeEnv?: string
    fixtures?: string
    token?: string
    url?: string
    dataset?: string
  } = {
    nodeEnv: NODE_ENV,
    fixtures: ANALYTICS_FIXTURES,
    token: AXIOM_QUERY_TOKEN,
    url: AXIOM_QUERY_URL,
    dataset: NEXT_PUBLIC_AXIOM_DATASET,
  },
): AnalyticsConfig {
  const base = {
    url: env.url || DEFAULT_AXIOM_QUERY_URL,
    dataset: env.dataset || 'steel-app',
  }
  if (env.fixtures === 'true' && env.nodeEnv !== 'production') {
    return { ...base, source: 'fixtures' }
  }
  if (env.token) return { ...base, source: 'axiom', token: env.token }
  return { ...base, source: 'unconfigured' }
}
