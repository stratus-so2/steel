import { describe, expect, it } from 'vitest'
import { confirmTotpSchema, disableTotpSchema } from '../two-factor.schema'

describe('confirmTotpSchema', () => {
  it('accepts six digits', () => {
    expect(confirmTotpSchema.parse({ code: '123456' })).toEqual({
      code: '123456',
    })
  })

  it('trims the surrounding whitespace a paste brings along', () => {
    expect(confirmTotpSchema.parse({ code: '  123456 ' })).toEqual({
      code: '123456',
    })
  })

  it('rejects fewer than six digits', () => {
    expect(confirmTotpSchema.safeParse({ code: '12345' }).success).toBe(false)
  })

  it('rejects more than six digits', () => {
    expect(confirmTotpSchema.safeParse({ code: '1234567' }).success).toBe(false)
  })

  it('rejects anything that is not a digit', () => {
    expect(confirmTotpSchema.safeParse({ code: '12a456' }).success).toBe(false)
    expect(confirmTotpSchema.safeParse({ code: '12 456' }).success).toBe(false)
  })

  it('rejects an empty code', () => {
    expect(confirmTotpSchema.safeParse({ code: '' }).success).toBe(false)
  })

  it('rejects a missing code', () => {
    expect(confirmTotpSchema.safeParse({}).success).toBe(false)
  })

  it('rejects a non-string code', () => {
    expect(confirmTotpSchema.safeParse({ code: 123456 }).success).toBe(false)
  })

  it('explains in pt-BR what the field expects', () => {
    const parsed = confirmTotpSchema.safeParse({ code: 'abc' })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(
      'Informe os 6 dígitos que o aplicativo mostra',
    )
  })
})

describe('disableTotpSchema', () => {
  it('accepts a password', () => {
    expect(disableTotpSchema.parse({ password: 'senha-forte' })).toEqual({
      password: 'senha-forte',
    })
  })

  it('rejects an empty password', () => {
    const parsed = disableTotpSchema.safeParse({ password: '' })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(
      'Informe sua senha para continuar',
    )
  })

  it('rejects a missing password', () => {
    expect(disableTotpSchema.safeParse({}).success).toBe(false)
  })

  it('does not trim the password: whitespace can be part of it', () => {
    expect(disableTotpSchema.parse({ password: ' a b ' })).toEqual({
      password: ' a b ',
    })
  })
})
