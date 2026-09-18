import { describe, expect, it, vi } from 'vitest'

// Cenário oposto ao de `ai-provider-factory.test.ts`: só a chave do Claude.
vi.mock('@/lib/env/server', () => ({
  OPENAI_API_KEY: undefined,
  ANTHROPIC_API_KEY: 'sk-ant-test',
}))

import { getAiProvider, getOpenAiClient, isAiProviderConfigured } from '../ai'

describe('AI provider factory (Anthropic only)', () => {
  it('should report only Anthropic as configured', () => {
    expect(isAiProviderConfigured('anthropic')).toBe(true)
    expect(isAiProviderConfigured('openai')).toBe(false)
  })

  it('should build and cache the Anthropic adapter', () => {
    const provider = getAiProvider('anthropic')
    expect(provider?.id).toBe('anthropic')
    expect(getAiProvider('anthropic')).toBe(provider)
    expect(getAiProvider('openai')).toBeNull()
  })

  it('should not expose a raw OpenAI client without its key', () => {
    expect(getOpenAiClient()).toBeNull()
  })
})
