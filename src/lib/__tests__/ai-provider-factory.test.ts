import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env/server', () => ({
  OPENAI_API_KEY: 'sk-test',
  ANTHROPIC_API_KEY: undefined,
}))

import { getAiProvider, isAiProviderConfigured } from '../ai'

describe('AI provider factory', () => {
  it('should report a provider as configured only when its key exists', () => {
    expect(isAiProviderConfigured('openai')).toBe(true)
    expect(isAiProviderConfigured('anthropic')).toBe(false)
  })

  it('should return null for a provider without an API key', () => {
    expect(getAiProvider('anthropic')).toBeNull()
  })

  it('should build (and reuse) the adapter for a configured provider', () => {
    const provider = getAiProvider('openai')
    expect(provider?.id).toBe('openai')
    expect(getAiProvider('openai')).toBe(provider)
  })
})
