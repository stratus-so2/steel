import { describe, expect, it } from 'vitest'
import {
  createFakeSdDashboardCost,
  createFakeSdDashboardEvent,
  createFakeSdDashboardKbArticle,
  createFakeSdDashboardTicket,
} from '@/src/__tests__/factories/sd-dashboard.factory'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import {
  flattenSdCustomFields,
  sdDueInLabel,
  toSdCostDashboardRow,
  toSdEventDashboardRow,
  toSdKbDashboardRow,
  toSdTicketDashboardRow,
} from '../sd-dashboard-source.mapper'

const NOW = new Date('2026-09-21T12:00:00.000Z')
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)
const ctx = {
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
  atRiskPercent: 80,
  topPriorityLevel: 4,
  now: NOW,
}

describe('toSdTicketDashboardRow', () => {
  it('maps an open, at-risk, critical ticket with labels and derived fields', () => {
    const row = toSdTicketDashboardRow(
      createFakeSdDashboardTicket({
        number: 42,
        type: 'INCIDENT',
        createdAt: at(-90),
        firstResponseDueAt: at(-80),
        firstRespondedAt: at(-85),
        resolutionDueAt: at(10),
        priority: { name: 'P1', level: 4 },
        severity: { name: 'Alta', level: 3 },
        impact: { name: 'Alto', level: 3 },
        urgency: { name: 'Alta', level: 3 },
        department: { name: 'Infra' },
        assignee: { name: 'Ana' },
        assigneeId: 'u1',
        requester: { name: 'Beto' },
        customer: { name: 'ACME' },
        company: { name: 'ACME SA' },
        contact: { name: 'Carla' },
        category: { name: 'Rede' },
        subcategory: { name: 'VPN' },
        service: { name: 'Acesso remoto' },
        classification: { name: 'Falha' },
        tags: ['vip'],
        customFields: { local: 'Matriz', urgente: true, turnos: ['A', 'B'] },
      }),
      ctx,
    )
    expect(row).toMatchObject({
      code: 'INC-000042',
      type: 'Incidente',
      phaseCategory: 'Novo',
      channel: 'Portal',
      priority: 'P1',
      priorityLevel: 4,
      severity: 'Alta',
      impact: 'Alto',
      urgency: 'Alta',
      department: 'Infra',
      assignee: 'Ana',
      requester: 'Beto',
      customer: 'ACME',
      company: 'ACME SA',
      contact: 'Carla',
      category: 'Rede',
      subcategory: 'VPN',
      service: 'Acesso remoto',
      classification: 'Falha',
      isOpen: true,
      isUnassigned: false,
      isCritical: true,
      slaFirstResponseState: 'Cumprido',
      slaResolutionState: 'Em risco',
      slaAtRisk: true,
      slaBreached: false,
      slaFirstResponseMetPct: 100,
      slaResolutionMetPct: null,
      resolutionRemainingMinutes: 10,
      resolutionDueIn: 'em 10 min',
      firstResponseMinutes: 5,
      resolutionMinutes: null,
      resolutionHours: null,
      ageHours: 1.5,
      reopenedPct: 0,
      cf_local: 'Matriz',
      cf_urgente: true,
      cf_turnos: 'A, B',
    })
  })

  it('computes MTTR, SLA verdict and reopen flag for a resolved ticket', () => {
    const row = toSdTicketDashboardRow(
      createFakeSdDashboardTicket({
        createdAt: at(-300),
        resolutionDueAt: at(-200),
        resolvedAt: at(-150),
        phase: { name: 'Resolvido', category: 'RESOLVED' },
        reopenCount: 1,
        csatScore: 4,
      }),
      ctx,
    )
    expect(row).toMatchObject({
      isOpen: false,
      isUnassigned: false,
      slaResolutionState: 'Violado',
      slaBreached: true,
      slaAtRisk: false,
      slaResolutionMetPct: 0,
      resolutionMinutes: 150,
      resolutionHours: 2.5,
      ageHours: null,
      reopenedPct: 100,
      csatScore: 4,
      slaFirstResponseState: 'Sem SLA',
    })
  })

  it('flags unassigned tickets and never marks critical without priorities', () => {
    const row = toSdTicketDashboardRow(
      createFakeSdDashboardTicket({ priority: { name: 'P4', level: 1 } }),
      { ...ctx, topPriorityLevel: null },
    )
    expect(row.isUnassigned).toBe(true)
    expect(row.isCritical).toBe(false)
    const noPriority = toSdTicketDashboardRow(
      createFakeSdDashboardTicket(),
      ctx,
    )
    expect(noPriority.isCritical).toBe(false)
    expect(noPriority.priorityLevel).toBeNull()
  })

  it('uses the policy calendar for open tickets and reports overdue ones', () => {
    const row = toSdTicketDashboardRow(
      createFakeSdDashboardTicket({
        createdAt: at(-600),
        resolutionDueAt: at(-90),
        slaPolicy: {
          calendar: {
            timezone: 'America/Sao_Paulo',
            schedule: {},
            holidays: [],
            is24x7: true,
          },
        },
      }),
      ctx,
    )
    expect(row.slaResolutionState).toBe('Violado')
    expect(row.resolutionDueIn).toBe('atrasado 1 h 30 min')
    expect(row.slaResolutionMetPct).toBe(0)
  })
})

describe('sdDueInLabel', () => {
  it('formats minutes, hours and days', () => {
    expect(sdDueInLabel(null)).toBeNull()
    expect(sdDueInLabel(45)).toBe('em 45 min')
    expect(sdDueInLabel(120)).toBe('em 2 h')
    expect(sdDueInLabel(-3000)).toBe('atrasado 2 d')
  })
})

describe('flattenSdCustomFields', () => {
  it('keeps primitives, joins lists and ignores objects', () => {
    expect(
      flattenSdCustomFields({ a: 1, b: null, c: { x: 1 }, d: ['x', 2] }),
    ).toEqual({ cf_a: 1, cf_b: null, cf_d: 'x, 2' })
    expect(flattenSdCustomFields(null)).toEqual({})
    expect(flattenSdCustomFields([1])).toEqual({})
  })
})

describe('toSdCostDashboardRow', () => {
  it('flattens a cost with its ticket context and total', () => {
    const row = toSdCostDashboardRow(
      createFakeSdDashboardCost(),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(row).toMatchObject({
      ticketCode: 'REQ-000007',
      ticketType: 'Requisição',
      ticketCategory: 'Hardware',
      category: 'Mão de obra',
      quantity: 2,
      unitCost: 150.5,
      total: 301,
      technician: 'Téc. Ana',
      department: 'Suporte',
      customer: 'ACME',
    })
  })

  it('handles costs without technician nor ticket relations', () => {
    const row = toSdCostDashboardRow(
      createFakeSdDashboardCost({
        user: null,
        ticket: {
          number: 1,
          type: 'INCIDENT',
          title: 'x',
          category: null,
          priority: null,
          department: null,
          customer: null,
        },
      }),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(row.technician).toBeNull()
    expect(row.ticketCategory).toBeNull()
    expect(row.department).toBeNull()
    expect(row.customer).toBeNull()
  })
})

describe('toSdEventDashboardRow', () => {
  it('maps creation and resolution into the throughput series', () => {
    const created = toSdEventDashboardRow(
      createFakeSdDashboardEvent(),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(created).toMatchObject({
      flow: 'Criados',
      throughput: 'Criados',
      actionLabel: 'Chamado aberto',
      actorKind: 'Agente',
      actor: 'Ana',
      priority: 'P3',
      department: 'Suporte',
    })
    const resolved = toSdEventDashboardRow(
      createFakeSdDashboardEvent({
        action: 'phase.changed',
        meta: { toCategory: 'RESOLVED' },
      }),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(resolved.flow).toBe('Resolvidos')
    expect(resolved.throughput).toBe('Resolvidos')
  })

  it('keeps other flows out of the throughput series', () => {
    const moved = toSdEventDashboardRow(
      createFakeSdDashboardEvent({
        action: 'phase.changed',
        meta: { toCategory: 'IN_PROGRESS' },
      }),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(moved.flow).toBeNull()
    const noMeta = toSdEventDashboardRow(
      createFakeSdDashboardEvent({ action: 'phase.changed', meta: [1] }),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(noMeta.flow).toBeNull()
    const escalated = toSdEventDashboardRow(
      createFakeSdDashboardEvent({
        action: 'escalated',
        actor: null,
        actorKind: 'SYSTEM',
        ticket: {
          number: 2,
          type: 'CHANGE',
          title: 'x',
          category: null,
          priority: null,
          department: null,
          customer: null,
        },
      }),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(escalated).toMatchObject({
      flow: 'Escalonados',
      throughput: null,
      actor: null,
      actorKind: 'Sistema',
      priority: null,
      department: null,
    })
    const unknown = toSdEventDashboardRow(
      createFakeSdDashboardEvent({ action: 'custom.thing' }),
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(unknown.actionLabel).toBe('custom.thing')
    expect(unknown.flow).toBeNull()
  })
})

describe('toSdKbDashboardRow', () => {
  it('computes the helpful rate and labels', () => {
    expect(toSdKbDashboardRow(createFakeSdDashboardKbArticle())).toMatchObject({
      status: 'Publicado',
      visibility: 'Portal',
      category: 'Acesso',
      author: 'Ana',
      helpfulPct: 75,
    })
  })

  it('returns null rate without votes and handles missing relations', () => {
    const row = toSdKbDashboardRow(
      createFakeSdDashboardKbArticle({
        helpfulCount: 0,
        notHelpfulCount: 0,
        category: null,
        createdBy: null,
        publishedAt: null,
        status: 'DRAFT',
        visibility: 'INTERNAL',
      }),
    )
    expect(row).toMatchObject({
      helpfulPct: null,
      category: null,
      author: null,
      publishedAt: null,
      status: 'Rascunho',
      visibility: 'Interno',
    })
  })
})
