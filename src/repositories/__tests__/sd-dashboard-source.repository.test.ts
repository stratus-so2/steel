import { describe, expect, it, vi } from 'vitest'
import { seedSdKbArticle } from '@/src/__tests__/factories/sd-kb.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdPhaseFlow,
  seedSdPriority,
  seedSdSettings,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdDashboardSourceRepository } from '../sd-dashboard-source.repository'

const NOW = new Date('2026-09-21T12:00:00.000Z')
const SINCE = new Date('2026-09-01T00:00:00.000Z')
const OLD = new Date('2025-01-01T00:00:00.000Z')

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const flow = await seedSdPhaseFlow(workspace.id)
  return { workspace, user, flow }
}

describe('SdDashboardSourceRepository', () => {
  describe('context()', () => {
    it('returns defaults without settings nor priorities', async () => {
      const { workspace } = await setup()
      expect(
        expectOk(await SdDashboardSourceRepository.context(workspace.id)),
      ).toEqual({
        ticketPrefixes: null,
        slaAtRiskPercent: 80,
        topPriorityLevel: null,
      })
    })

    it('reads prefixes, the SLA threshold and the highest priority', async () => {
      const { workspace } = await setup()
      await seedSdSettings(workspace.id, { slaAtRiskPercent: 70 })
      await seedSdPriority(workspace.id, { level: 1 })
      await seedSdPriority(workspace.id, { level: 4 })
      const ctx = expectOk(
        await SdDashboardSourceRepository.context(workspace.id),
      )
      expect(ctx.slaAtRiskPercent).toBe(70)
      expect(ctx.topPriorityLevel).toBe(4)
      expect(ctx.ticketPrefixes).toMatchObject({ INCIDENT: 'INC' })
    })
  })

  describe('listTickets()', () => {
    it('returns open tickets of any age and recent closed ones, newest first', async () => {
      const { workspace, flow } = await setup()
      const other = await seedWorkspace()
      const otherFlow = await seedSdPhaseFlow(other.id)
      const oldOpen = await seedSdTicket(workspace.id, flow.initial.id, {
        createdAt: OLD,
      })
      const recentClosed = await seedSdTicket(workspace.id, flow.closed.id, {
        createdAt: new Date('2026-09-10T00:00:00.000Z'),
        closedAt: new Date('2026-09-11T00:00:00.000Z'),
      })
      const oldResolvedRecently = await seedSdTicket(
        workspace.id,
        flow.resolved.id,
        {
          createdAt: new Date('2024-06-01T00:00:00.000Z'),
          resolvedAt: new Date('2026-09-05T00:00:00.000Z'),
        },
      )
      await seedSdTicket(workspace.id, flow.closed.id, {
        createdAt: OLD,
        closedAt: OLD,
      })
      await seedSdTicket(workspace.id, flow.initial.id, { deletedAt: NOW })
      await seedSdTicket(other.id, otherFlow.initial.id)

      const rows = expectOk(
        await SdDashboardSourceRepository.listTickets(workspace.id, SINCE, 10),
      )
      expect(rows.map((r) => r.id)).toEqual([
        recentClosed.id,
        oldOpen.id,
        oldResolvedRecently.id,
      ])
      expect(rows[0].phase).toEqual({ name: 'Fechado', category: 'CLOSED' })
    })

    it('respects the row limit', async () => {
      const { workspace, flow } = await setup()
      await seedSdTicket(workspace.id, flow.initial.id)
      await seedSdTicket(workspace.id, flow.initial.id)
      const rows = expectOk(
        await SdDashboardSourceRepository.listTickets(workspace.id, SINCE, 1),
      )
      expect(rows).toHaveLength(1)
    })
  })

  describe('listCosts()', () => {
    it('lists recent costs of live tickets with their context', async () => {
      const { workspace, user, flow } = await setup()
      const ticket = await seedSdTicket(workspace.id, flow.initial.id)
      const deleted = await seedSdTicket(workspace.id, flow.initial.id, {
        deletedAt: NOW,
      })
      const base = {
        workspaceId: workspace.id,
        description: 'Visita',
        unitCost: 100,
        createdById: user.id,
      }
      const recent = await prisma.sdTicketCost.create({
        data: {
          ...base,
          ticketId: ticket.id,
          incurredAt: NOW,
          userId: user.id,
        },
      })
      await prisma.sdTicketCost.create({
        data: { ...base, ticketId: ticket.id, incurredAt: OLD },
      })
      await prisma.sdTicketCost.create({
        data: { ...base, ticketId: deleted.id, incurredAt: NOW },
      })

      const rows = expectOk(
        await SdDashboardSourceRepository.listCosts(workspace.id, SINCE, 10),
      )
      expect(rows.map((r) => r.id)).toEqual([recent.id])
      expect(rows[0].ticket.number).toBe(ticket.number)
      expect(rows[0].user?.name).toBe(user.name)
    })
  })

  describe('listEvents()', () => {
    it('lists only flow events since the window', async () => {
      const { workspace, flow } = await setup()
      const ticket = await seedSdTicket(workspace.id, flow.initial.id)
      const base = {
        workspaceId: workspace.id,
        ticketId: ticket.id,
        actorKind: 'AGENT' as const,
      }
      const created = await prisma.sdTicketEvent.create({
        data: { ...base, action: 'ticket.created', createdAt: NOW },
      })
      await prisma.sdTicketEvent.create({
        data: { ...base, action: 'field.changed', createdAt: NOW },
      })
      await prisma.sdTicketEvent.create({
        data: { ...base, action: 'ticket.created', createdAt: OLD },
      })

      const rows = expectOk(
        await SdDashboardSourceRepository.listEvents(workspace.id, SINCE, 10),
      )
      expect(rows.map((r) => r.id)).toEqual([created.id])
      expect(rows[0].ticket.type).toBe('INCIDENT')
    })
  })

  describe('listKbArticles()', () => {
    it('lists non-archived articles by views', async () => {
      const { workspace, user } = await setup()
      const popular = await seedSdKbArticle(workspace.id, {
        createdById: user.id,
        viewCount: 50,
      })
      const quiet = await seedSdKbArticle(workspace.id, { viewCount: 1 })
      await seedSdKbArticle(workspace.id, { archivedAt: NOW })

      const rows = expectOk(
        await SdDashboardSourceRepository.listKbArticles(workspace.id, 10),
      )
      expect(rows.map((r) => r.id)).toEqual([popular.id, quiet.id])
    })
  })

  it('maps Prisma failures to DATABASE_ERROR', async () => {
    const boom = new Error('boom')
    vi.spyOn(prisma.sdTicket, 'findMany').mockRejectedValueOnce(boom)
    vi.spyOn(prisma.sdTicketCost, 'findMany').mockRejectedValueOnce(boom)
    vi.spyOn(prisma.sdTicketEvent, 'findMany').mockRejectedValueOnce(boom)
    vi.spyOn(prisma.sdKbArticle, 'findMany').mockRejectedValueOnce(boom)
    vi.spyOn(prisma.sdSettings, 'findUnique').mockRejectedValueOnce(boom)

    expectErr(
      await SdDashboardSourceRepository.listTickets('ws', SINCE, 1),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdDashboardSourceRepository.listCosts('ws', SINCE, 1),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdDashboardSourceRepository.listEvents('ws', SINCE, 1),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdDashboardSourceRepository.listKbArticles('ws', 1),
      'DATABASE_ERROR',
    )
    expectErr(await SdDashboardSourceRepository.context('ws'), 'DATABASE_ERROR')
  })
})
