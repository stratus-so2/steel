import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { BETTER_AUTH_SECRET } from '@/lib/env/server'
import { err, ok, type Result } from '@/src/lib/result'
import {
  type CRM_SOCIAL_PLATFORMS,
  parseCrmPlatformSlug,
} from '@/src/schemas/crm-social.schema'

/**
 * `state` do OAuth: protege o callback contra CSRF e carrega o workspace
 * (o callback é um path fixo, sem o workspaceId, então ele viaja aqui).
 * Stateless: assinado por HMAC-SHA256 com `BETTER_AUTH_SECRET`, com
 * expiração curta.
 *
 * Formato: `<payloadBase64url>.<assinaturaBase64url>`.
 */

const STATE_TTL_MS = 10 * 60 * 1000 // 10 min

type StatePayload = {
  workspaceId: string
  slug: string
  platform: (typeof CRM_SOCIAL_PLATFORMS)[number]
  nonce: string
  exp: number
}

function sign(payloadB64: string): string {
  return createHmac('sha256', BETTER_AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url')
}

/** Cria um `state` assinado para a plataforma/workspace informados. */
export function createOauthState(
  workspaceId: string,
  slug: string,
  platform: (typeof CRM_SOCIAL_PLATFORMS)[number],
): string {
  const payload: StatePayload = {
    workspaceId,
    slug,
    platform,
    nonce: randomBytes(16).toString('base64url'),
    exp: Date.now() + STATE_TTL_MS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${payloadB64}.${sign(payloadB64)}`
}

/**
 * Verifica assinatura e expiração, devolvendo o payload. `Result` para que o
 * service mapeie falha → erro sem distinguir o motivo ao cliente.
 */
export function verifyOauthState(
  state: string,
): Result<StatePayload, 'invalid'> {
  const [payloadB64, signature] = state.split('.')
  if (!payloadB64 || !signature) return err('invalid')

  const expected = sign(payloadB64)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return err('invalid')

  let payload: StatePayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return err('invalid')
  }

  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    return err('invalid')
  }
  if (!parseCrmPlatformSlug(payload.platform)) {
    return err('invalid')
  }
  if (
    typeof payload.workspaceId !== 'string' ||
    payload.workspaceId.length === 0
  ) {
    return err('invalid')
  }

  return ok(payload)
}
