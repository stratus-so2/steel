import { describe, expect, it } from 'vitest'
import {
  signResendPayload,
  verifyResendSignature,
} from '../crm-campaign/resend-webhook'

const secret = `whsec_${Buffer.from('super-secret-key').toString('base64')}`
const now = new Date('2026-10-09T13:00:00.000Z')
const timestamp = String(Math.floor(now.getTime() / 1000))
const body = '{"type":"email.delivered","data":{"email_id":"e1"}}'

function input(
  overrides?: Partial<Parameters<typeof verifyResendSignature>[0]>,
) {
  return {
    secret,
    id: 'msg_1',
    timestamp,
    signature: `v1,${signResendPayload(secret, 'msg_1', timestamp, body)}`,
    body,
    now,
    ...overrides,
  }
}

describe('verifyResendSignature', () => {
  it('should accept a valid signature among several', () => {
    expect(verifyResendSignature(input())).toBe(true)
    expect(
      verifyResendSignature(
        input({ signature: `v1,bogus v2,x ${input().signature}` }),
      ),
    ).toBe(true)
  })

  it('should reject tampering, missing headers and replays', () => {
    expect(verifyResendSignature(input({ body: `${body} ` }))).toBe(false)
    expect(verifyResendSignature(input({ id: null }))).toBe(false)
    expect(verifyResendSignature(input({ timestamp: null }))).toBe(false)
    expect(verifyResendSignature(input({ signature: null }))).toBe(false)
    expect(verifyResendSignature(input({ timestamp: 'abc' }))).toBe(false)
    expect(
      verifyResendSignature(input({ now: new Date(now.getTime() + 600_000) })),
    ).toBe(false)
    expect(verifyResendSignature(input({ signature: 'v1' }))).toBe(false)
  })
})
