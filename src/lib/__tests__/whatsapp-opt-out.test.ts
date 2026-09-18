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
    'descadastrar',
    'DESCADASTRAR!',
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
    // Fora da lista de propósito: responder "Cancelar" a um lembrete de
    // consulta não pode descadastrar o contato das transmissões.
    'cancelar',
    'CANCELAR',
    'saira',
    'stopped',
  ])('should not match %j', (text) => {
    expect(isWhatsAppOptOutKeyword(text)).toBe(false)
  })
})
