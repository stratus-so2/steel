import { describe, expect, it } from 'vitest'
import {
  POSTHOG_DEFAULT_HOST,
  POSTHOG_PROXY_PATH,
  posthogAssetHost,
} from '@/lib/posthog/constants'

describe('posthog constants', () => {
  it('defaults to a https ingestion host', () => {
    expect(POSTHOG_DEFAULT_HOST).toMatch(/^https:\/\//)
  })

  it('keeps the browser on a same-origin path so the CSP needs no new host', () => {
    // A CSP do Steel não usa `strict-dynamic` (ADR 0011): cada origem nova
    // precisa ser nomeada à mão. Um caminho relativo não precisa de nenhuma.
    expect(POSTHOG_PROXY_PATH.startsWith('/')).toBe(true)
    expect(POSTHOG_PROXY_PATH).not.toContain('://')
  })
})

describe('posthogAssetHost', () => {
  it('points a cloud region at its sibling asset host', () => {
    expect(posthogAssetHost('https://us.i.posthog.com')).toBe(
      'https://us-assets.i.posthog.com',
    )
    expect(posthogAssetHost('https://eu.i.posthog.com')).toBe(
      'https://eu-assets.i.posthog.com',
    )
  })

  it('leaves a self-hosted host untouched', () => {
    expect(posthogAssetHost('https://ph.stratustelecom.com.br')).toBe(
      'https://ph.stratustelecom.com.br',
    )
  })

  it('leaves a host that already names the asset sibling untouched', () => {
    expect(posthogAssetHost('https://us-assets.i.posthog.com')).toBe(
      'https://us-assets.i.posthog.com',
    )
  })

  it('refuses to rewrite a non-https host', () => {
    expect(posthogAssetHost('http://us.i.posthog.com')).toBe(
      'http://us.i.posthog.com',
    )
  })
})
