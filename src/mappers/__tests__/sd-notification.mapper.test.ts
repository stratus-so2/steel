import { describe, expect, it } from 'vitest'
import { createFakeSdNotificationPreference } from '@/src/__tests__/factories/sd-notification.factory'
import {
  SD_NOTIFICATION_EVENTS,
  SD_NOTIFICATION_GROUPS,
  sdNotificationEvent,
} from '@/src/config/servicedesk-notifications'
import {
  sdChannelEnabled,
  sdPreferenceIndex,
  toSdNotificationPreferencesDTO,
  toSdTicketFollowerDTO,
} from '../sd-notification.mapper'

const assigned = sdNotificationEvent('ticket.assigned')
if (!assigned) throw new Error('catálogo sem ticket.assigned')

describe('sdPreferenceIndex', () => {
  it('indexa por `evento|canal`', () => {
    const index = sdPreferenceIndex([
      { event: 'ticket.message', channel: 'EMAIL', enabled: false },
      { event: 'ticket.message', channel: 'IN_APP', enabled: true },
    ])
    expect(index.get('ticket.message|EMAIL')).toBe(false)
    expect(index.get('ticket.message|IN_APP')).toBe(true)
    expect(index.has('ticket.message|WHATSAPP')).toBe(false)
  })
})

describe('sdChannelEnabled', () => {
  it('sem linha salva vale o padrão do catálogo', () => {
    const empty = new Map<string, boolean>()
    expect(sdChannelEnabled(assigned, 'IN_APP', empty)).toBe(true)
    expect(sdChannelEnabled(assigned, 'EMAIL', empty)).toBe(true)
    expect(sdChannelEnabled(assigned, 'WHATSAPP', empty)).toBe(false)
  })

  it('a linha salva vence o padrão', () => {
    const saved = new Map([
      ['ticket.assigned|EMAIL', false],
      ['ticket.assigned|WHATSAPP', true],
    ])
    expect(sdChannelEnabled(assigned, 'EMAIL', saved)).toBe(false)
    expect(sdChannelEnabled(assigned, 'WHATSAPP', saved)).toBe(true)
  })

  it('canal que o evento não oferece fica desligado mesmo salvo', () => {
    const note = sdNotificationEvent('ticket.internal_note')
    if (!note) throw new Error('catálogo sem ticket.internal_note')
    const saved = new Map([['ticket.internal_note|EMAIL', true]])
    expect(sdChannelEnabled(note, 'EMAIL', saved)).toBe(false)
    expect(sdChannelEnabled(note, 'IN_APP', saved)).toBe(true)
  })
})

describe('toSdNotificationPreferencesDTO', () => {
  it('monta a matriz agrupada com padrões e personalizações', () => {
    const dto = toSdNotificationPreferencesDTO({
      rows: [
        createFakeSdNotificationPreference({
          event: 'ticket.message',
          channel: 'EMAIL',
          enabled: false,
        }),
      ],
      isAgent: true,
      whatsappAvailable: true,
    })
    expect(dto).toMatchObject({ isAgent: true, whatsappAvailable: true })
    expect(dto.groups.map((g) => g.label)).toEqual(
      SD_NOTIFICATION_GROUPS.map((g) => g.label),
    )

    const message = dto.groups
      .flatMap((g) => g.events)
      .find((e) => e.event === 'ticket.message')
    expect(message).toMatchObject({
      label: 'Nova mensagem no chamado',
      channels: ['IN_APP', 'EMAIL', 'WHATSAPP'],
      defaultChannels: ['IN_APP', 'EMAIL'],
      enabledChannels: ['IN_APP'],
      customized: true,
      agentOnly: false,
    })
    expect(message?.audience).toContain('followers')

    const assignedRow = dto.groups
      .flatMap((g) => g.events)
      .find((e) => e.event === 'ticket.assigned')
    expect(assignedRow).toMatchObject({ customized: false, agentOnly: true })
  })

  it('expõe todos os eventos do catálogo para um agente', () => {
    const dto = toSdNotificationPreferencesDTO({
      rows: [],
      isAgent: true,
      whatsappAvailable: false,
    })
    const keys = dto.groups.flatMap((g) => g.events.map((e) => e.event)).sort()
    expect(keys).toEqual(SD_NOTIFICATION_EVENTS.map((e) => e.key).sort())
  })

  it('ignora chave de grupo que não existe no catálogo', () => {
    const dto = toSdNotificationPreferencesDTO({
      rows: [],
      isAgent: true,
      whatsappAvailable: false,
      groups: [
        { label: 'Misto', events: ['ticket.message', 'nao.existe'] },
        { label: 'Vazio', events: ['tambem.nao'] },
      ],
    })
    expect(dto.groups).toHaveLength(1)
    expect(dto.groups[0]).toMatchObject({ label: 'Misto' })
    expect(dto.groups[0].events.map((e) => e.event)).toEqual(['ticket.message'])
  })

  it('esconde eventos `agentOnly` e grupos que ficam vazios do solicitante', () => {
    const dto = toSdNotificationPreferencesDTO({
      rows: [],
      isAgent: false,
      whatsappAvailable: false,
    })
    const events = dto.groups.flatMap((g) => g.events)
    expect(events.every((e) => !e.agentOnly)).toBe(true)
    expect(dto.groups.map((g) => g.label)).not.toContain('Resumos')
    expect(dto.groups.map((g) => g.label)).not.toContain('SLA e escalonamento')
  })
})

describe('toSdTicketFollowerDTO', () => {
  it('converte a linha com a data em ISO', () => {
    expect(
      toSdTicketFollowerDTO({
        userId: 'u1',
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        user: {
          id: 'u1',
          name: 'Ana Agente',
          email: 'ana@example.com',
          image: null,
        },
      }),
    ).toEqual({
      userId: 'u1',
      name: 'Ana Agente',
      email: 'ana@example.com',
      image: null,
      followedAt: '2026-10-01T12:00:00.000Z',
    })
  })
})
