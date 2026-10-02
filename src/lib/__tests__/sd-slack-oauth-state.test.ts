import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { BETTER_AUTH_SECRET } from '@/lib/env/server'
import {
  createSdSlackOauthState,
  verifySdSlackOauthState,
} from '@/src/lib/servicedesk/slack-oauth-state'

const NOW = 1_790_000_000_000

describe('state do OAuth do Slack', () => {
  it('leva o workspace e o slug de volta', () => {
    const state = createSdSlackOauthState('ws1', 'acme', NOW)
    const parsed = verifySdSlackOauthState(state, NOW + 1000)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('esperava ok')
    expect(parsed.value.workspaceId).toBe('ws1')
    expect(parsed.value.slug).toBe('acme')
  })

  it('não repete o nonce', () => {
    const a = createSdSlackOauthState('ws1', 'acme', NOW)
    const b = createSdSlackOauthState('ws1', 'acme', NOW)
    expect(a).not.toBe(b)
  })

  it('recusa state sem as duas partes', () => {
    expect(verifySdSlackOauthState('', NOW).ok).toBe(false)
    expect(verifySdSlackOauthState('sopayload', NOW).ok).toBe(false)
    expect(verifySdSlackOauthState('payload.', NOW).ok).toBe(false)
  })

  it('recusa assinatura trocada e de tamanho diferente', () => {
    const state = createSdSlackOauthState('ws1', 'acme', NOW)
    const [payload] = state.split('.')
    expect(verifySdSlackOauthState(`${payload}.xxxx`, NOW).ok).toBe(false)
    const forged = `${payload}.${'a'.repeat(43)}`
    expect(verifySdSlackOauthState(forged, NOW).ok).toBe(false)
  })

  it('recusa payload adulterado (a assinatura não fecha)', () => {
    const state = createSdSlackOauthState('ws1', 'acme', NOW)
    const [, signature] = state.split('.')
    const other = Buffer.from(
      JSON.stringify({
        workspaceId: 'ws2',
        slug: 'outro',
        nonce: 'x',
        exp: NOW + 1000,
      }),
    ).toString('base64url')
    expect(verifySdSlackOauthState(`${other}.${signature}`, NOW).ok).toBe(false)
  })

  it('recusa state expirado', () => {
    const state = createSdSlackOauthState('ws1', 'acme', NOW)
    expect(verifySdSlackOauthState(state, NOW + 11 * 60 * 1000).ok).toBe(false)
  })

  it('recusa payload assinado que não é JSON nem tem os campos', () => {
    // O `state` é assinado com BETTER_AUTH_SECRET, que o teste conhece —
    // então dá para forjar um payload **bem assinado** e exercitar as
    // validações de conteúdo (não só a da assinatura).
    const signed = (payload: string) => {
      const encoded = Buffer.from(payload).toString('base64url')
      const signature = createHmac('sha256', BETTER_AUTH_SECRET)
        .update(encoded)
        .digest('base64url')
      return `${encoded}.${signature}`
    }

    expect(verifySdSlackOauthState(signed('nao-e-json'), NOW).ok).toBe(false)
    expect(
      verifySdSlackOauthState(signed(JSON.stringify({ slug: 'y' })), NOW).ok,
    ).toBe(false)
    expect(
      verifySdSlackOauthState(
        signed(JSON.stringify({ exp: 'depois', workspaceId: 'w', slug: 'y' })),
        NOW,
      ).ok,
    ).toBe(false)
    expect(
      verifySdSlackOauthState(
        signed(JSON.stringify({ exp: NOW + 1000, slug: 'y' })),
        NOW,
      ).ok,
    ).toBe(false)
    expect(
      verifySdSlackOauthState(
        signed(JSON.stringify({ exp: NOW + 1000, workspaceId: 'w' })),
        NOW,
      ).ok,
    ).toBe(false)
  })

  it('recusa workspace ou slug vazio no payload assinado', () => {
    const empty = createSdSlackOauthState('', 'acme', NOW)
    expect(verifySdSlackOauthState(empty, NOW).ok).toBe(false)
    const noSlug = createSdSlackOauthState('ws1', '', NOW)
    expect(verifySdSlackOauthState(noSlug, NOW).ok).toBe(false)
  })

  it('usa o relógio real quando `now` não é informado', () => {
    const state = createSdSlackOauthState('ws1', 'acme')
    expect(verifySdSlackOauthState(state).ok).toBe(true)
  })
})
