import { describe, expect, it } from 'vitest'
import { zapiErrorMessage } from '@/src/lib/whatsapp/zapi-client'

describe('zapiErrorMessage', () => {
  it('explains a missing or wrong Client-Token', () => {
    expect(
      zapiErrorMessage({ error: 'your client-token is not configured' }, 400),
    ).toContain('Client-Token (token de segurança da conta)')
  })

  it('reads the reason from `error`, then `message`', () => {
    expect(zapiErrorMessage({ error: 'Instance not found' }, 400)).toBe(
      'A Z-API recusou a chamada (400): Instance not found',
    )
    expect(zapiErrorMessage({ message: 'Token inválido' }, 401)).toBe(
      'A Z-API recusou a chamada (401): Token inválido',
    )
  })

  it('falls back to the status when the body has no reason', () => {
    expect(zapiErrorMessage(null, 500)).toBe('Falha na requisição Z-API (500)')
    expect(zapiErrorMessage({ error: 42 }, 502)).toBe(
      'Falha na requisição Z-API (502)',
    )
  })
})
