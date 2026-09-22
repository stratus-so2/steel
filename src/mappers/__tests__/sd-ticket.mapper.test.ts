import { describe, expect, it } from 'vitest'
import {
  createFakeSdEscalation,
  createFakeSdSavedView,
  createFakeSdTicket,
  createFakeSdTicketEvent,
  createFakeSdUserSummary,
} from '@/src/__tests__/factories/sd-ticket.factory'
import { WEEK_8x5 } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { toSdSavedViewDTO } from '../sd-saved-view.mapper'
import { toSdTicketDTO } from '../sd-ticket.mapper'
import {
  toSdTicketEscalationDTO,
  toSdTicketEventDTO,
} from '../sd-ticket-event.mapper'

const customer = {
  id: 'c1',
  name: 'ACME',
  tradeName: 'Acme',
  document: '12345678000190',
}

describe('toSdTicketDTO', () => {
  it('maps a bare ticket with defaults', () => {
    const dto = toSdTicketDTO(
      createFakeSdTicket({ number: 12, customFields: [] as never }),
    )
    expect(dto.code).toBe('INC-000012')
    expect(dto.customFields).toEqual({})
    expect(dto.sla.firstResponse.state).toBe('none')
    expect(dto.customer).toBeNull()
    expect(dto.parent).toBeNull()
    expect(dto.firstResponseDueAt).toBeNull()
  })

  it('maps relations, dates, SLA with calendar and custom prefixes', () => {
    const assignee = createFakeSdUserSummary({ id: 'u1' })
    const t = createFakeSdTicket({
      type: 'CHANGE',
      number: 3,
      impact: { id: 'i', name: 'Alto', level: 3 },
      urgency: { id: 'u', name: 'Alta', level: 3 },
      priority: { id: 'p', name: 'P1', level: 4, color: '#f00' },
      customer,
      company: customer,
      assignee,
      requester: assignee,
      createdBy: assignee,
      participants: [{ userId: 'u1', user: assignee }],
      parent: { id: 'x', number: 1, title: 'Pai', type: 'PROBLEM' },
      customFields: { contrato: 'GOLD' },
      firstResponseDueAt: new Date('2026-09-21T13:00:00Z'),
      resolvedAt: new Date('2026-09-21T14:00:00Z'),
      closedAt: new Date('2026-09-21T15:00:00Z'),
      aiSummary: 'resumo',
      aiTriage: { categoria: 'x' },
      slaPolicy: {
        id: 'sla',
        calendar: {
          timezone: 'America/Sao_Paulo',
          schedule: WEEK_8x5,
          holidays: [],
          is24x7: false,
        },
      },
    })
    const dto = toSdTicketDTO(t, {
      prefixes: {
        INCIDENT: 'INC',
        SERVICE_REQUEST: 'REQ',
        CHANGE: 'MUD',
        PROBLEM: 'PRB',
      },
      now: new Date('2026-09-21T12:30:00Z'),
      atRiskPercent: 50,
    })
    expect(dto.code).toBe('MUD-000003')
    expect(dto.parent).toEqual({
      id: 'x',
      number: 1,
      code: 'PRB-000001',
      title: 'Pai',
      type: 'PROBLEM',
    })
    expect(dto.impact).toEqual({ id: 'i', name: 'Alto', level: 3, color: null })
    expect(dto.urgency?.color).toBeNull()
    expect(dto.customer?.document).toBe('12345678000190')
    expect(dto.participants).toEqual([assignee])
    expect(dto.sla.firstResponse.state).toBe('at_risk')
    expect(dto.aiSummary).toBe('resumo')
    expect(dto.aiTriage).toEqual({ categoria: 'x' })
    expect(dto.resolvedAt).toBe('2026-09-21T14:00:00.000Z')
  })

  it('hides AI and customer documents from requesters', () => {
    const dto = toSdTicketDTO(
      createFakeSdTicket({ customer, aiSummary: 's', aiTriage: { a: 1 } }),
      { audience: 'requester' },
    )
    expect(dto.customer?.document).toBeNull()
    expect(dto.aiSummary).toBeNull()
    expect(dto.aiTriage).toBeNull()
  })
})

describe('event, escalation and saved-view mappers', () => {
  it('maps events with and without actor/meta', () => {
    const actor = createFakeSdUserSummary()
    expect(
      toSdTicketEventDTO(
        createFakeSdTicketEvent({ actor, meta: { a: 1 }, toValue: 'x' }),
      ),
    ).toMatchObject({ actor, meta: { a: 1 }, toValue: 'x', fromValue: null })
    expect(
      toSdTicketEventDTO(createFakeSdTicketEvent({ meta: [1] })).meta,
    ).toBeNull()
    expect(toSdTicketEventDTO(createFakeSdTicketEvent()).actor).toBeNull()
  })

  it('maps escalations', () => {
    const dto = toSdTicketEscalationDTO(
      createFakeSdEscalation({
        createdBy: createFakeSdUserSummary({ id: 'u' }),
      }),
    )
    expect(dto.createdBy?.id).toBe('u')
    expect(dto.createdAt).toBe('2026-09-21T12:00:00.000Z')
    expect(
      toSdTicketEscalationDTO(createFakeSdEscalation()).createdBy,
    ).toBeNull()
  })

  it('maps saved views tolerating malformed JSON', () => {
    const ok = toSdSavedViewDTO(
      createFakeSdSavedView({
        filters: { a: 1 },
        sort: [{ field: 'x', order: 'asc' }],
        columns: ['title'],
      }),
      true,
    )
    expect(ok).toMatchObject({
      filters: { a: 1 },
      sort: [{ field: 'x', order: 'asc' }],
      columns: ['title'],
      editable: true,
    })
    const bad = toSdSavedViewDTO(
      createFakeSdSavedView({ filters: [1], sort: {}, columns: null as never }),
      false,
    )
    expect(bad).toMatchObject({
      filters: {},
      sort: [],
      columns: [],
      editable: false,
    })
  })
})
