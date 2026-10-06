import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  sdAgents,
  sdApprovalDTO,
  sdConfigDTO,
  sdCustomerDTO,
  sdDashboardRow,
  sdKbArticleDTO,
  sdMessageDTO,
  sdTaskDTO,
  sdTicketDTO,
} from '@/src/__tests__/factories/steel-ai-sd.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  databaseError,
  sdNotAgent,
  sdTicketForbidden,
  sdTicketNotFound,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdTicketDTO } from '@/types/sd-ticket'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/services/sd-config.service')
vi.mock('@/src/services/sd-ticket.service')
vi.mock('@/src/services/sd-customer.service')
vi.mock('@/src/services/sd-dashboard-source.service')
vi.mock('@/src/services/sd-ticket-message.service')
vi.mock('@/src/services/sd-ticket-event.service')
vi.mock('@/src/services/sd-ticket-task.service')
vi.mock('@/src/services/sd-ticket-approval.service')
vi.mock('@/src/services/sd-kb-ticket-link.service')

import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { SdConfigService } from '@/src/services/sd-config.service'
import { SdCustomerService } from '@/src/services/sd-customer.service'
import { SdDashboardSourceService } from '@/src/services/sd-dashboard-source.service'
import { SdKbTicketLinkService } from '@/src/services/sd-kb-ticket-link.service'
import { SdTicketService } from '@/src/services/sd-ticket.service'
import { SdTicketApprovalService } from '@/src/services/sd-ticket-approval.service'
import { SdTicketEventService } from '@/src/services/sd-ticket-event.service'
import { SdTicketMessageService } from '@/src/services/sd-ticket-message.service'
import { SdTicketTaskService } from '@/src/services/sd-ticket-task.service'
import {
  buildTicketQuery,
  sdGetTicketTool,
  sdMyQueueTool,
  sdSearchTicketsTool,
  sdSlaAtRiskTool,
  sdTicketCountsTool,
} from '../ai/tools/servicedesk/tickets-read'

const ctx = {
  workspaceId: 'ws1',
  actorId: 'user-me',
  source: 'assistant' as const,
}
const tickets = vi.mocked(SdTicketService)
const ID = 'abcdefghijklmnopqrstuvwx'

function ticketPage(items: SdTicketDTO[], total = items.length) {
  return ok({ items, total, page: 1, pageSize: 20, nextCursor: null })
}

function parseSearch(args: Record<string, unknown>) {
  return expectOk(sdSearchTicketsTool.parse(args))
}

beforeEach(() => {
  vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
    ok({ slug: 'acme' } as never),
  )
  vi.mocked(SdConfigService.bootstrap).mockResolvedValue(ok(sdConfigDTO()))
  vi.mocked(SdConfigService.agents).mockResolvedValue(ok(sdAgents()))
})

describe('sd_search_tickets', () => {
  it('should cap the limit at 50 and default to 20', () => {
    expect(parseSearch({}).limit).toBe(20)
    expectErr(sdSearchTicketsTool.parse({ limit: 51 }), 'VALIDATION_ERROR')
    expectErr(sdSearchTicketsTool.parse({ sla: 'late' }), 'VALIDATION_ERROR')
  })

  it('should list open tickets with compact fields and deep links', async () => {
    tickets.list.mockResolvedValue(ticketPage([sdTicketDTO()], 45))
    const out = expectOk(
      await sdSearchTicketsTool.execute(ctx, parseSearch({ query: 'e-mail' })),
    )
    const data = out.data as {
      total: number
      hasMore: boolean
      items: unknown[]
    }
    expect(data.total).toBe(45)
    expect(data.hasMore).toBe(true)
    expect(data.items[0]).toMatchObject({
      code: 'INC-000042',
      phase: 'Novo',
      href: '/acme/servicedesk/tickets/42',
    })
    expect(out.summary).toBe('45 chamado(s) encontrado(s)')
    expect(tickets.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({
        q: 'e-mail',
        includeClosed: false,
        pageSize: 20,
        page: 1,
      }),
    )
  })

  it('should surface list and slug errors', async () => {
    tickets.list.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdSearchTicketsTool.execute(ctx, parseSearch({})),
      'SD_NOT_AGENT',
    )
    tickets.list.mockResolvedValue(ticketPage([]))
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(
      await sdSearchTicketsTool.execute(ctx, parseSearch({})),
      'DATABASE_ERROR',
    )
  })

  it('should return query-building errors before listing', async () => {
    expectErr(
      await sdSearchTicketsTool.execute(
        ctx,
        parseSearch({ phase: 'Inexistente' }),
      ),
      'VALIDATION_ERROR',
    )
    expect(tickets.list).not.toHaveBeenCalled()
  })
})

describe('buildTicketQuery', () => {
  it('should resolve phase names across flows, priority and department', async () => {
    const query = expectOk(
      await buildTicketQuery(
        ctx,
        parseSearch({
          phase: 'Em andamento',
          priority: 'crítica',
          department: 'Redes',
          practice: 'incident',
          sla: 'at_risk',
          createdFrom: '2026-09-01',
        }),
      ),
    )
    expect(query).toMatchObject({
      type: 'INCIDENT',
      phaseIds: ['ph-inc-prog'],
      priorityIds: ['pri-crit'],
      departmentIds: ['dep-net'],
      sla: 'at_risk',
    })
    const all = expectOk(
      await buildTicketQuery(ctx, parseSearch({ phase: 'Em andamento' })),
    )
    expect(all.phaseIds).toEqual(['ph-inc-prog', 'ph-req-prog'])
  })

  it('should include closed tickets for done phase categories', async () => {
    const query = expectOk(
      await buildTicketQuery(ctx, parseSearch({ phaseCategory: 'RESOLVED' })),
    )
    expect(query.includeClosed).toBe(true)
    expect(query.phaseCategories).toEqual(['RESOLVED'])
    expect(SdConfigService.bootstrap).not.toHaveBeenCalled()
  })

  it('should report config, priority and department errors', async () => {
    vi.mocked(SdConfigService.bootstrap).mockResolvedValueOnce(
      err(databaseError('x')),
    )
    expectErr(
      await buildTicketQuery(ctx, parseSearch({ priority: 'Alta' })),
      'DATABASE_ERROR',
    )
    expectErr(
      await buildTicketQuery(ctx, parseSearch({ priority: 'Média' })),
      'VALIDATION_ERROR',
    )
    const ambiguous = expectErr(
      await buildTicketQuery(ctx, parseSearch({ department: 'sup' })),
    )
    expect(ambiguous.message).toContain('ambíguo')
  })

  it('should map me/unassigned/ids without loading members', async () => {
    const query = expectOk(
      await buildTicketQuery(
        ctx,
        parseSearch({ assignee: 'unassigned', requester: 'me' }),
      ),
    )
    expect(query.assigneeIds).toEqual(['unassigned'])
    expect(query.requesterId).toBe('me')
    const byId = expectOk(
      await buildTicketQuery(
        ctx,
        parseSearch({ assignee: ID, requester: 'unassigned' }),
      ),
    )
    expect(byId.assigneeIds).toEqual([ID])
    expect(byId.requesterId).toBeUndefined()
    expect(SdConfigService.agents).not.toHaveBeenCalled()
  })

  it('should resolve people by name/e-mail once and report ambiguity', async () => {
    const query = expectOk(
      await buildTicketQuery(
        ctx,
        parseSearch({
          assignee: 'Bruno Lima',
          requester: 'carlos@cliente.com',
        }),
      ),
    )
    expect(query.assigneeIds).toEqual(['user-bruno'])
    expect(query.requesterId).toBe('user-req')
    expect(SdConfigService.agents).toHaveBeenCalledTimes(1)
    expect(SdConfigService.agents).toHaveBeenCalledWith('user-me', 'ws1', {
      includeRequesters: true,
    })

    const ambiguous = expectErr(
      await buildTicketQuery(ctx, parseSearch({ assignee: 'brun' })),
    )
    expect(ambiguous.details).toMatchObject({
      candidates: [
        { id: 'user-bruno', name: 'Bruno Lima' },
        { id: 'user-bruna', name: 'Bruna Souza' },
      ],
    })
    vi.mocked(SdConfigService.agents).mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await buildTicketQuery(ctx, parseSearch({ assignee: 'Bruno' })),
      'SD_NOT_AGENT',
    )
  })

  it('should resolve customer and company by name', async () => {
    vi.mocked(SdCustomerService.list).mockResolvedValue(
      ok({ items: [sdCustomerDTO()], total: 1, page: 1, pageSize: 10 }),
    )
    const query = expectOk(
      await buildTicketQuery(
        ctx,
        parseSearch({ customer: 'Acme', company: 'Acme' }),
      ),
    )
    expect(query.customerId).toBe('cust-1')
    expect(query.companyId).toBe('cust-1')
    expect(SdCustomerService.list).toHaveBeenLastCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({ kind: 'COMPANY' }),
    )
    vi.mocked(SdCustomerService.list).mockResolvedValueOnce(
      ok({ items: [], total: 0, page: 1, pageSize: 10 }),
    )
    expectErr(
      await buildTicketQuery(ctx, parseSearch({ customer: 'Nada' })),
      'VALIDATION_ERROR',
    )
    vi.mocked(SdCustomerService.list).mockResolvedValueOnce(
      ok({ items: [], total: 0, page: 1, pageSize: 10 }),
    )
    expectErr(
      await buildTicketQuery(ctx, parseSearch({ company: 'Nada' })),
      'VALIDATION_ERROR',
    )
  })

  it('should reject filters the ticket list schema refuses', async () => {
    const tooLong = { ...parseSearch({}), query: 'y'.repeat(201) }
    expectErr(await buildTicketQuery(ctx, tooLong), 'VALIDATION_ERROR')
  })
})

describe('sd_my_queue', () => {
  it('should list my open tickets by resolution due date', async () => {
    tickets.list.mockResolvedValue(ticketPage([sdTicketDTO()]))
    const out = expectOk(
      await sdMyQueueTool.execute(ctx, expectOk(sdMyQueueTool.parse({}))),
    )
    expect(out.summary).toBe('1 chamado(s) na fila')
    expect(tickets.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({
        assigneeIds: ['me'],
        sort: 'resolutionDueAt',
        order: 'asc',
      }),
    )
  })

  it('should list unassigned tickets in my departments', async () => {
    vi.mocked(SdConfigService.me).mockResolvedValue(
      ok({ ...sdConfigDTO().me, departmentIds: ['dep-sup'] }),
    )
    tickets.list.mockResolvedValue(ticketPage([]))
    const args = expectOk(
      sdMyQueueTool.parse({ scope: 'unassigned_in_my_departments', limit: 5 }),
    )
    expectOk(await sdMyQueueTool.execute(ctx, args))
    expect(tickets.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({
        assigneeIds: ['unassigned'],
        departmentIds: ['dep-sup'],
        pageSize: 5,
      }),
    )
  })

  it('should explain an empty queue without departments and surface errors', async () => {
    const args = expectOk(
      sdMyQueueTool.parse({ scope: 'unassigned_in_my_departments' }),
    )
    vi.mocked(SdConfigService.me).mockResolvedValue(
      ok({ ...sdConfigDTO().me, departmentIds: [] }),
    )
    const out = expectOk(await sdMyQueueTool.execute(ctx, args))
    expect(out.summary).toBe('Você não faz parte de nenhum departamento')
    vi.mocked(SdConfigService.me).mockResolvedValue(err(databaseError('x')))
    expectErr(await sdMyQueueTool.execute(ctx, args), 'DATABASE_ERROR')

    const mine = expectOk(sdMyQueueTool.parse({}))
    tickets.list.mockResolvedValue(err(databaseError('x')))
    expectErr(await sdMyQueueTool.execute(ctx, mine), 'DATABASE_ERROR')
    tickets.list.mockResolvedValue(ticketPage([]))
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await sdMyQueueTool.execute(ctx, mine), 'DATABASE_ERROR')
  })
})

describe('sd_get_ticket', () => {
  function mockSections() {
    vi.mocked(SdTicketMessageService.list).mockResolvedValue(
      ok({
        items: [
          sdMessageDTO({ body: 'x'.repeat(600) }),
          sdMessageDTO({
            id: 'msg-2',
            author: null,
            contact: { id: 'c', name: 'Joana' },
          }),
          sdMessageDTO({ id: 'msg-3', author: null, contact: null }),
        ],
        nextBefore: null,
      }),
    )
    vi.mocked(SdTicketEventService.list).mockResolvedValue(
      ok({
        items: [
          {
            id: 'ev',
            ticketId: 'ticket-1',
            actorKind: 'SYSTEM',
            actor: null,
            action: 'ticket.created',
            field: null,
            fromValue: null,
            toValue: null,
            meta: null,
            createdAt: '2026-10-01T12:00:00.000Z',
          },
          {
            id: 'ev2',
            ticketId: 'ticket-1',
            actorKind: 'AGENT',
            actor: { id: 'u', name: 'Ana', email: 'a@a', image: null },
            action: 'field.changed',
            field: 'priorityId',
            fromValue: null,
            toValue: null,
            meta: null,
            createdAt: '2026-10-01T12:00:00.000Z',
          },
        ],
        nextCursor: null,
      }),
    )
    vi.mocked(SdTicketTaskService.list).mockResolvedValue(
      ok({
        items: [
          sdTaskDTO(),
          sdTaskDTO({
            id: 'task-2',
            assignee: { id: 'u', name: 'Ana', email: 'a@a', image: null },
          }),
        ],
        progress: { done: 0, total: 2, percent: 0 },
      }),
    )
    vi.mocked(SdTicketApprovalService.list).mockResolvedValue(
      ok([sdApprovalDTO(), sdApprovalDTO({ id: 'a2', approverName: null })]),
    )
    vi.mocked(SdKbTicketLinkService.listForTicket).mockResolvedValue(
      ok([
        {
          ticketId: 'ticket-1',
          article: sdKbArticleDTO(),
          linkedById: null,
          resolvedTicket: true,
          createdAt: '2026-10-01T12:00:00.000Z',
        },
      ]),
    )
  }

  it('should require a ticket ref', () => {
    expectErr(sdGetTicketTool.parse({}), 'VALIDATION_ERROR')
  })

  it('should return the ticket with history, tasks, approvals and KB', async () => {
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          category: { id: 'cat-net', name: 'Rede' },
          service: { id: 's', name: 'Liberar acesso' },
          requester: {
            id: 'r',
            name: 'Carlos',
            email: 'carlos@x.com',
            image: null,
          },
          configItem: { id: 'ci-1', name: 'srv', code: null },
          parent: {
            id: 'p',
            number: 1,
            code: 'PRB-000001',
            title: 'Pai',
            type: 'PROBLEM',
          },
          impact: { id: 'i', name: 'Alto', level: 3, color: null },
          urgency: { id: 'u', name: 'Alta', level: 3, color: null },
          severity: { id: 's', name: 'Sev 1', level: 1, color: null },
          company: { id: 'co', name: 'Acme', tradeName: null, document: null },
          risk: {
            level: 'HIGH',
            score: 90,
            factors: [
              { key: 'queue', label: 'Fila', weight: 10, detail: 'Fila cheia' },
            ],
            breachEtaAt: null,
            computedAt: '',
          },
        }),
      ),
    )
    mockSections()
    const out = expectOk(
      await sdGetTicketTool.execute(ctx, { ticket: 'INC-000042' }),
    )
    const data = out.data as Record<string, unknown>
    expect(data).toMatchObject({
      code: 'INC-000042',
      description: 'Ninguém recebe e-mail',
      catalog: 'Rede > Liberar acesso',
      requesterEmail: 'carlos@x.com',
      parent: 'PRB-000001',
      risk: { level: 'HIGH', score: 90, reasons: ['Fila cheia'] },
      knowledge: [
        {
          id: 'kb-1',
          href: '/acme/servicedesk/knowledge/kb-1',
          resolvedTicket: true,
        },
      ],
    })
    const messages = data.recentMessages as { author: string; body: string }[]
    expect(messages.map((m) => m.author)).toEqual([
      'Ana Agente',
      'Joana',
      'AGENT',
    ])
    expect(messages[0].body).toHaveLength(501)
    expect(
      (data.recentEvents as { actor: string }[]).map((e) => e.actor),
    ).toEqual(['SYSTEM', 'Ana'])
    expect(
      (data.approvals as { approver: string }[]).map((a) => a.approver),
    ).toEqual(['Bruno Lima', 'bruno@acme.com'])
    expect(out.target).toEqual({
      type: 'sd_ticket',
      id: 'ticket-1',
      label: 'INC-000042',
      href: '/acme/servicedesk/tickets/42',
    })
    expect(tickets.get).toHaveBeenCalledWith('user-me', 'ws1', 'INC-000042')
  })

  it('should leave agent-only sections empty for requesters', async () => {
    tickets.get.mockResolvedValue(
      ok(
        sdTicketDTO({
          contact: {
            id: 'c',
            name: 'Joana',
            email: 'j@x.com',
            phone: null,
            userId: null,
          },
        }),
      ),
    )
    mockSections()
    vi.mocked(SdTicketEventService.list).mockResolvedValue(err(sdNotAgent()))
    vi.mocked(SdTicketTaskService.list).mockResolvedValue(err(sdNotAgent()))
    vi.mocked(SdTicketApprovalService.list).mockResolvedValue(err(sdNotAgent()))
    const out = expectOk(await sdGetTicketTool.execute(ctx, { ticket: '42' }))
    expect(out.data).toMatchObject({
      requesterEmail: 'j@x.com',
      recentEvents: null,
      tasks: null,
      approvals: null,
      risk: null,
      catalog: '',
    })
  })

  it('should surface not found, forbidden and slug errors', async () => {
    tickets.get.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await sdGetTicketTool.execute(ctx, { ticket: '999' }),
      'SD_TICKET_NOT_FOUND',
    )
    tickets.get.mockResolvedValue(err(sdTicketForbidden()))
    expectErr(
      await sdGetTicketTool.execute(ctx, { ticket: '1' }),
      'SD_TICKET_FORBIDDEN',
    )
    tickets.get.mockResolvedValue(ok(sdTicketDTO()))
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(
      await sdGetTicketTool.execute(ctx, { ticket: '1' }),
      'DATABASE_ERROR',
    )
  })
})

describe('sd_sla_at_risk', () => {
  const summary = {
    byPhaseCategory: {
      NEW: 1,
      IN_PROGRESS: 2,
      WAITING: 0,
      RESOLVED: 0,
      CLOSED: 0,
      CANCELED: 0,
    },
    myOpen: 3,
    unassigned: 1,
    atRisk: 2,
    breached: 1,
    createdToday: 4,
  }

  it('should return the counts and both lists', async () => {
    tickets.summary.mockResolvedValue(ok(summary))
    tickets.list.mockResolvedValue(ticketPage([sdTicketDTO()]))
    const out = expectOk(
      await sdSlaAtRiskTool.execute(
        ctx,
        expectOk(sdSlaAtRiskTool.parse({ limit: 5 })),
      ),
    )
    expect(out.summary).toBe('2 em risco, 1 violado(s)')
    expect(out.data).toMatchObject({
      counts: {
        atRisk: 2,
        breached: 1,
        myOpen: 3,
        unassigned: 1,
        createdToday: 4,
      },
    })
    expect(tickets.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({ sla: 'breached', pageSize: 5 }),
    )
  })

  it('should surface each failing read', async () => {
    const args = expectOk(sdSlaAtRiskTool.parse({}))
    tickets.summary.mockResolvedValue(err(databaseError('x')))
    tickets.list.mockResolvedValue(ticketPage([]))
    expectErr(await sdSlaAtRiskTool.execute(ctx, args), 'DATABASE_ERROR')

    tickets.summary.mockResolvedValue(ok(summary))
    tickets.list.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await sdSlaAtRiskTool.execute(ctx, args), 'SD_NOT_AGENT')

    tickets.list
      .mockResolvedValueOnce(ticketPage([]))
      .mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await sdSlaAtRiskTool.execute(ctx, args), 'SD_NOT_AGENT')

    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await sdSlaAtRiskTool.execute(ctx, args), 'DATABASE_ERROR')
  })
})

describe('sd_ticket_counts', () => {
  const rows = [
    sdDashboardRow({ isOpen: true, slaAtRisk: true }),
    sdDashboardRow({
      id: 't2',
      type: 'Requisição',
      department: 'Redes',
      priority: null,
      isUnassigned: false,
      slaBreached: true,
    }),
    sdDashboardRow({
      id: 't3',
      isOpen: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      resolvedAt: '2026-10-02T00:00:00.000Z',
    }),
    sdDashboardRow({ id: 't4', department: null }),
  ]

  it('should validate the period', () => {
    expectErr(
      sdTicketCountsTool.parse({ from: '2026-10-05', to: '2026-10-01' }),
      'VALIDATION_ERROR',
    )
  })

  it('should count open tickets by dimension and created × resolved', async () => {
    vi.mocked(SdDashboardSourceService.rows).mockResolvedValue(ok(rows))
    const args = expectOk(
      sdTicketCountsTool.parse({ from: '2026-09-01', to: '2026-10-05' }),
    )
    const out = expectOk(await sdTicketCountsTool.execute(ctx, args))
    expect(out.data).toMatchObject({
      open: {
        total: 3,
        unassigned: 2,
        slaAtRisk: 1,
        slaBreached: 1,
        byPhase: { Novo: 3 },
        byPriority: { Alta: 2, '(vazio)': 1 },
        byDepartment: { Suporte: 1, Redes: 1, '(vazio)': 1 },
        byPractice: { Incidente: 2, Requisição: 1 },
      },
      period: { created: 3, resolved: 1 },
    })
    expect(SdDashboardSourceService.rows).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      'sd-tickets',
    )
  })

  it('should default to the last 30 days and filter by practice/department', async () => {
    vi.mocked(SdDashboardSourceService.rows).mockResolvedValue(ok(rows))
    const out = expectOk(
      await sdTicketCountsTool.execute(
        ctx,
        expectOk(
          sdTicketCountsTool.parse({
            practice: 'request',
            department: 'redes',
          }),
        ),
      ),
    )
    expect((out.data as { open: { total: number } }).open.total).toBe(1)
    expectErr(
      await sdTicketCountsTool.execute(
        ctx,
        expectOk(sdTicketCountsTool.parse({ department: 'Financeiro' })),
      ),
      'VALIDATION_ERROR',
    )
    vi.mocked(SdDashboardSourceService.rows).mockResolvedValue(
      err(sdNotAgent()),
    )
    expectErr(
      await sdTicketCountsTool.execute(
        ctx,
        expectOk(sdTicketCountsTool.parse({})),
      ),
      'SD_NOT_AGENT',
    )
  })
})
