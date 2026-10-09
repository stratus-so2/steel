import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { BETTER_AUTH_SECRET } from '@/lib/env/server'

/**
 * Signed, stateless tokens of the campaign links (ADR 0025). Each one names
 * a recipient row and, for links, the channel that carried it — so a click
 * is attributed to the right funnel. HMAC-SHA256 with domain separation (not
 * interchangeable with other tokens signed by the same secret), truncated to
 * 22 chars (128 bits) to keep WhatsApp links short. No expiry: an old e-mail
 * still opens the page and still unsubscribes.
 *
 * Link: `<recipientId>-<e|w>.<sig>` · Unsubscribe: `<recipientId>.<sig>`.
 */

export type CampaignLinkChannel = 'EMAIL' | 'WHATSAPP'

const LINK_DOMAIN = 'crm-campaign-link:v1'
const UNSUBSCRIBE_DOMAIN = 'crm-campaign-unsubscribe:v1'
const CHANNEL_CODE: Record<CampaignLinkChannel, string> = {
  EMAIL: 'e',
  WHATSAPP: 'w',
}

function sign(domain: string, payload: string): string {
  return createHmac('sha256', BETTER_AUTH_SECRET)
    .update(`${domain}:${payload}`)
    .digest('base64url')
    .slice(0, 22)
}

function verify(domain: string, token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const signature = Buffer.from(token.slice(dot + 1))
  const expected = Buffer.from(sign(domain, payload))
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    return null
  }
  return payload
}

export function createCampaignLinkToken(
  recipientId: string,
  channel: CampaignLinkChannel,
): string {
  const payload = `${recipientId}-${CHANNEL_CODE[channel]}`
  return `${payload}.${sign(LINK_DOMAIN, payload)}`
}

export function verifyCampaignLinkToken(
  token: string,
): { recipientId: string; channel: CampaignLinkChannel } | null {
  const payload = verify(LINK_DOMAIN, token)
  if (!payload) return null
  const match = /^(.+)-([ew])$/.exec(payload)
  if (!match) return null
  return {
    recipientId: match[1],
    channel: match[2] === 'e' ? 'EMAIL' : 'WHATSAPP',
  }
}

export function createCampaignUnsubscribeToken(recipientId: string): string {
  return `${recipientId}.${sign(UNSUBSCRIBE_DOMAIN, recipientId)}`
}

/** Recipient id when the signature matches. */
export function verifyCampaignUnsubscribeToken(token: string): string | null {
  return verify(UNSUBSCRIBE_DOMAIN, token)
}

/** Public URLs of the tracking endpoints. */
export function campaignClickUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/crm/campaigns/c/${token}`
}

export function campaignOpenPixelUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/crm/campaigns/o/${token}`
}
