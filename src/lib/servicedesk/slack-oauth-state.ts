import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { BETTER_AUTH_SECRET } from '@/lib/env/server'
import { err, ok, type Result } from '@/src/lib/result'

/**
 * `state` do OAuth do Slack: protege o callback contra CSRF e carrega o
 * workspace, porque o callback é um path fixo (o Slack exige redirect URL
 * exata, sem o `workspaceId`). Stateless e assinado por HMAC-SHA256 com
 * `BETTER_AUTH_SECRET`, com validade curta — o mesmo desenho do OAuth de
 * redes sociais do CRM.
 *
 * Formato: `<payloadBase64url>.<assinaturaBase64url>`.
 */

const STATE_TTL_MS = 10 * 60 * 1000

export interface SdSlackOauthState {
  workspaceId: string
  slug: string
  nonce: string
  exp: number
}

function sign(payload: string): string {
  return createHmac('sha256', BETTER_AUTH_SECRET)
    .update(payload)
    .digest('base64url')
}

export function createSdSlackOauthState(
  workspaceId: string,
  slug: string,
  now = Date.now(),
): string {
  const payload: SdSlackOauthState = {
    workspaceId,
    slug,
    nonce: randomBytes(16).toString('base64url'),
    exp: now + STATE_TTL_MS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

/** Confere assinatura e validade. O motivo não vaza para o cliente. */
export function verifySdSlackOauthState(
  state: string,
  now = Date.now(),
): Result<SdSlackOauthState, 'invalid'> {
  const [encoded, signature] = state.split('.')
  if (!encoded || !signature) return err('invalid')

  const expected = sign(encoded)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return err('invalid')

  let payload: SdSlackOauthState
  try {
    payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SdSlackOauthState
  } catch {
    return err('invalid')
  }

  if (typeof payload.exp !== 'number' || payload.exp < now)
    return err('invalid')
  if (typeof payload.workspaceId !== 'string' || payload.workspaceId === '') {
    return err('invalid')
  }
  if (typeof payload.slug !== 'string' || payload.slug === '') {
    return err('invalid')
  }
  return ok(payload)
}
