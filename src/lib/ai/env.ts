import 'server-only'
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  OPENAI_API_KEY,
  OPENAI_MODEL,
} from '@/lib/env/server'

/**
 * Configuração dos provedores de IA (OpenAI e Anthropic/Claude) do builder de
 * landing pages. Lido do módulo de env tipado do Steel. A feature é gateada
 * por `isAiConfigured()`: sem nenhum provedor configurado, o chat de IA da
 * landing page fica indisponível. O usuário escolhe o provedor no chat; a
 * seleção cai para um provedor disponível quando o pedido não está
 * configurado.
 */

export const AI_PROVIDERS = ['openai', 'anthropic'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export function getOpenAiKey(): string {
  return OPENAI_API_KEY?.trim() ?? ''
}

export function getOpenAiModel(): string {
  return OPENAI_MODEL?.trim() || 'gpt-4o'
}

export function getOpenAiBaseUrl(): string {
  return 'https://api.openai.com/v1'
}

export function isOpenAiConfigured(): boolean {
  return getOpenAiKey().length > 0
}

export function getAnthropicKey(): string {
  return ANTHROPIC_API_KEY?.trim() ?? ''
}

export function getAnthropicModel(): string {
  return ANTHROPIC_MODEL?.trim() || 'claude-opus-4-8'
}

export function isAnthropicConfigured(): boolean {
  return getAnthropicKey().length > 0
}

/** Lista dos provedores com chave configurada, na ordem de preferência. */
export function availableAiProviders(): AiProvider[] {
  const list: AiProvider[] = []
  if (isOpenAiConfigured()) list.push('openai')
  if (isAnthropicConfigured()) list.push('anthropic')
  return list
}

/** Há ao menos um provedor de IA configurado? */
export function isAiConfigured(): boolean {
  return availableAiProviders().length > 0
}

/**
 * Resolve o provedor efetivo: usa o pedido se estiver configurado; senão cai
 * para o primeiro disponível. Retorna `null` quando nenhum está configurado.
 */
export function resolveAiProvider(requested?: AiProvider): AiProvider | null {
  const available = availableAiProviders()
  if (available.length === 0) return null
  if (requested && available.includes(requested)) return requested
  return available[0]
}
