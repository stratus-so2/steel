import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdDashboardCost,
  createFakeSdDashboardEvent,
  createFakeSdDashboardKbArticle,
  createFakeSdDashboardTicket,
} from '@/src/__tests__/factories/sd-dashboard.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-dashboard-source.repository')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { SdDashboardSourceRepository } from '@/src/repositories/sd-dashboard-source.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SD_DASHBOARD_ROW_LIMITS } from '@/src/schemas/sd-dashboard.schema'
import type {
  SdKbArticleDashboardRow,
  SdTicketCostDashboardRow,
  SdTicketDashboardRow,
  SdTicketEventDashboardRow,
} from '@/types/sd-dashboard'
import { SdDashboardSourceService } from '../sd-dashboard-source.service'

const repo = vi.mocked(SdDashboardSourceRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const WS = 'ws1'
const NOW = new Date('2026-09-21T12:00:00.000Z')

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  repo.context.mockResolvedValue(
    ok({
      ticketPrefixes: { INCIDENT: 'CH' },
      slaAtRiskPercent: 70,
      topPriorityLevel: 4,
    }),
  )
})

describe('SdDashboardSourceService.rows', () => {
  describe('authorization', () => {
    it('refuses non-members', async () => {
      actAs('non-member')
      expectErr(
        await SdDashboardSourceService.rows('u1', WS, 'sd-tickets'),
        'FORBIDDEN',
      )
      expect(repo.listTickets).not.toHaveBeenCalled()
    })

    it('refuses when the module is disabled', async () => {
      actAs('agent')
      moduleAccess.isEnabled.mockResolvedValue(ok(false))
      expectErr(
        await SdDashboardSourceService.rows('u1', WS, 'sd-tickets'),
        'MODULE_DISABLED',
      )
    })

    it('refuses requesters (dashboards show the whole operation)', async () => {
      actAs('requester')
      expectErr(
        await SdDashboardSourceService.rows('u1', WS, 'sd-tickets'),
        'SD_NOT_AGENT',
      )
    })

    it('lets a VIEWER agent read (sd-dashboards:VIEW)', async () => {
      actAs('viewer-agent')
      repo.listKbArticles.mockResolvedValue(ok([]))
      expectOk(await SdDashboardSourceService.rows('u1', WS, 'sd-kb-articles'))
    })
  })

  it('maps tickets with the workspace prefixes, SLA threshold and top priority', async () => {
    actAs('agent')
    repo.listTickets.mockResolvedValue(
      ok([
        createFakeSdDashboardTicket({
          number: 5,
          priority: { name: 'P1', level: 4 },
        }),
      ]),
    )
    const rows = expectOk(
      await SdDashboardSourceService.rows('u1', WS, 'sd-tickets', NOW),
    ) as SdTicketDashboardRow[]
    expect(rows[0]).toMatchObject({ code: 'CH-000005', isCritical: true })
    const [, since, limit] = repo.listTickets.mock.calls[0]
    expect(limit).toBe(SD_DASHBOARD_ROW_LIMITS['sd-tickets'])
    expect(since.getTime()).toBe(NOW.getTime() - 400 * 86_400_000)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('logs when the ticket source hits the row limit', async () => {
    actAs('admin')
    const ticket = createFakeSdDashboardTicket()
    repo.listTickets.mockResolvedValue(
      ok(
        Array.from({ length: SD_DASHBOARD_ROW_LIMITS['sd-tickets'] }, () => ({
          ...ticket,
        })),
      ),
    )
    const rows = expectOk(
      await SdDashboardSourceService.rows('u1', WS, 'sd-tickets', NOW),
    )
    expect(rows).toHaveLength(SD_DASHBOARD_ROW_LIMITS['sd-tickets'])
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.dashboard.source_truncated',
      expect.objectContaining({ workspaceId: WS, source: 'sd-tickets' }),
    )
  })

  it('maps costs, events and KB articles', async () => {
    actAs('agent')
    repo.listCosts.mockResolvedValue(ok([createFakeSdDashboardCost()]))
    repo.listEvents.mockResolvedValue(ok([createFakeSdDashboardEvent()]))
    repo.listKbArticles.mockResolvedValue(
      ok([createFakeSdDashboardKbArticle()]),
    )

    const costs = expectOk(
      await SdDashboardSourceService.rows('u1', WS, 'sd-ticket-costs'),
    ) as SdTicketCostDashboardRow[]
    expect(costs[0].total).toBe(301)

    const events = expectOk(
      await SdDashboardSourceService.rows('u1', WS, 'sd-ticket-events'),
    ) as SdTicketEventDashboardRow[]
    expect(events[0].throughput).toBe('Criados')

    const kb = expectOk(
      await SdDashboardSourceService.rows('u1', WS, 'sd-kb-articles'),
    ) as SdKbArticleDashboardRow[]
    expect(kb[0].helpfulPct).toBe(75)
    expect(repo.listKbArticles).toHaveBeenCalledWith(
      WS,
      SD_DASHBOARD_ROW_LIMITS['sd-kb-articles'],
    )
  })

  it('propagates repository errors from every source', async () => {
    actAs('agent')
    repo.listTickets.mockResolvedValue(err(databaseError()))
    repo.listCosts.mockResolvedValue(err(databaseError()))
    repo.listEvents.mockResolvedValue(err(databaseError()))
    repo.listKbArticles.mockResolvedValue(err(databaseError()))
    for (const source of [
      'sd-tickets',
      'sd-ticket-costs',
      'sd-ticket-events',
      'sd-kb-articles',
    ] as const) {
      expectErr(
        await SdDashboardSourceService.rows('u1', WS, source),
        'DATABASE_ERROR',
      )
    }
  })

  it('propagates a context failure', async () => {
    actAs('agent')
    repo.context.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDashboardSourceService.rows('u1', WS, 'sd-tickets'),
      'DATABASE_ERROR',
    )
    expect(repo.listTickets).not.toHaveBeenCalled()
  })
})
