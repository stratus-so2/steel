import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signature check of Resend webhooks (Svix scheme): HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` with the base64 key after the
 * `whsec_` prefix; `svix-signature` lists `v1,<base64>` entries separated by
 * spaces. Timestamps older/newer than 5 minutes are refused (replay).
 */

const TOLERANCE_SECONDS = 5 * 60

export function signResendPayload(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  return createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
}

export function verifyResendSignature(input: {
  secret: string
  id: string | null
  timestamp: string | null
  signature: string | null
  body: string
  now: Date
}): boolean {
  const { id, timestamp, signature } = input
  if (!id || !timestamp || !signature) return false
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds)) return false
  if (Math.abs(input.now.getTime() / 1000 - seconds) > TOLERANCE_SECONDS) {
    return false
  }
  const expected = Buffer.from(
    signResendPayload(input.secret, id, timestamp, input.body),
  )
  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',')
    if (version !== 'v1' || !value) return false
    const given = Buffer.from(value)
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
