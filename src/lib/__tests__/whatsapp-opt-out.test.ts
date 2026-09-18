import { describe, expect, it } from 'vitest'
import { isWhatsAppOptOutKeyword } from '../whatsapp/opt-out'

describe('isWhatsAppOptOutKeyword()', () => {
  it.each([
    'SAIR',
    'sair',
    'Sair',
    '  sair  ',
    'Sair.',
    'PARAR!',
    'Stop',
    'cancelar',
    'CÁNCELAR',
    'descadastrar',
    'sáir',
  ])('should match %j', (text) => {
    expect(isWhatsAppOptOutKeyword(text)).toBe(true)
  })

  it.each([
    '',
    null,
    undefined,
    'quero sair',
    'sair do grupo',
    'pode parar de mandar?',
    'não quero cancelar',
    'saira',
    'stopped',
  ])('should not match %j', (text) => {
    expect(isWhatsAppOptOutKeyword(text)).toBe(false)
  })
})
