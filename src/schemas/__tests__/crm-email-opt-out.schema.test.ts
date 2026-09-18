import { describe, expect, it } from 'vitest'
import { CrmEmailUnsubscribeSchema } from '../crm-email-opt-out.schema'

describe('CrmEmailUnsubscribeSchema', () => {
  it('should accept a payload.signature token', () => {
    expect(
      CrmEmailUnsubscribeSchema.safeParse({
        token: 'Y2t4YWJjZGVm.c2lnbmF0dXJlLXNpZ25hdHVyZQ',
      }).success,
    ).toBe(true)
  })

  it.each([
    '',
    'sem-ponto-nenhum',
    'a.b',
    'com espaço.assinatura',
    `${'a'.repeat(400)}.${'b'.repeat(200)}`,
  ])('should reject malformed token %j', (token) => {
    expect(CrmEmailUnsubscribeSchema.safeParse({ token }).success).toBe(false)
  })
})
