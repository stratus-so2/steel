import { describe, expect, it } from 'vitest'
import {
  sdLocalHour,
  sdNotifyTicketOf,
  sdTicketNotificationHref,
} from '@/src/lib/servicedesk/notify'

describe('sdTicketNotificationHref', () => {
  it('monta o caminho interno da tela do chamado', () => {
    expect(sdTicketNotificationHref('acme', 7)).toBe(
      '/acme/servicedesk/tickets/7',
    )
  })
})

describe('sdNotifyTicketOf', () => {
  const base = {
    id: 't1',
    number: 7,
    title: 'Servidor fora do ar',
    assigneeId: 'a1',
    requesterId: 'r1',
    departmentId: 'd1',
    participants: [{ userId: 'p1' }, { userId: 'p2' }],
    contact: null,
  }

  it('recorta o chamado e achata os participantes', () => {
    expect(sdNotifyTicketOf(base, 'INC-000007')).toEqual({
      id: 't1',
      number: 7,
      code: 'INC-000007',
      title: 'Servidor fora do ar',
      assigneeId: 'a1',
      requesterId: 'r1',
      departmentId: 'd1',
      participantIds: ['p1', 'p2'],
      contact: null,
    })
  })

  it('mantém só id, nome e usuário do contato', () => {
    const out = sdNotifyTicketOf(
      {
        ...base,
        contact: { id: 'c1', name: 'Cliente', userId: 'cu' },
      },
      'INC-000007',
    )
    expect(out.contact).toEqual({ id: 'c1', name: 'Cliente', userId: 'cu' })
  })
})

describe('sdLocalHour', () => {
  const at = new Date('2026-10-01T11:00:00.000Z')

  it('converte para a hora local do fuso', () => {
    expect(sdLocalHour(at, 'America/Sao_Paulo')).toBe(8)
    expect(sdLocalHour(at, 'UTC')).toBe(11)
    expect(sdLocalHour(at, 'Asia/Tokyo')).toBe(20)
  })

  it('trata meia-noite local como 0 (e não 24)', () => {
    expect(
      sdLocalHour(new Date('2026-10-01T03:00:00.000Z'), 'America/Sao_Paulo'),
    ).toBe(0)
  })

  it('cai no horário UTC com fuso inválido', () => {
    expect(sdLocalHour(at, 'Nao/Existe')).toBe(11)
  })
})
