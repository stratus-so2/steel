import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from '@/lib/env/server'
import { createAnthropicProvider } from './anthropic-provider'
import type { AiProviderId } from './models'
import { createOpenAiProvider } from './openai-provider'
import type { AiProvider } from './types'

export * from './models'
export * from './types'

/**
 * Chaves de API são da plataforma (env), não do workspace. Um provedor sem
 * chave configurada aparece como indisponível nos ajustes e nunca é
 * resolvido para uma chamada.
 */
export function isAiProviderConfigured(provider: AiProviderId): boolean {
  return provider === 'openai'
    ? Boolean(OPENAI_API_KEY)
    : Boolean(ANTHROPIC_API_KEY)
}

const cache = new Map<AiProviderId, AiProvider>()

/** Retorna o adaptador do provedor, ou `null` se a chave não estiver configurada. */
export function getAiProvider(provider: AiProviderId): AiProvider | null {
  if (!isAiProviderConfigured(provider)) return null
  const cached = cache.get(provider)
  if (cached) return cached

  const instance =
    provider === 'openai'
      ? createOpenAiProvider(new OpenAI({ apiKey: OPENAI_API_KEY }))
      : createAnthropicProvider(new Anthropic({ apiKey: ANTHROPIC_API_KEY }))
  cache.set(provider, instance)
  return instance
}

/**
 * Client OpenAI cru, só para o que não tem equivalente no Claude
 * (transcrição de áudio com Whisper na resposta automática do WhatsApp).
 */
export function getOpenAiClient(): OpenAI | null {
  return OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null
}
