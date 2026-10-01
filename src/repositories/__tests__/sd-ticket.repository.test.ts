import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdContact,
  seedSdPhaseFlow,
  seedSdPriority,
  seedSdSettings,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  buildSdTicketWhere,
  SdTicketRepository,
  sdTicketOrderBy,
} from '../sd-ticket.repository'

const NOW = new Date('2026-09-21T12:00:00.000Z')
const past = new Date('2026-09-20T12:00:00.000Z')
const future = new Date('2026-09-25T12:00:00.000Z')

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const flow = await seedSdPhaseFlow(workspace.id)
  return { workspace, user, flow }
}

async function ids(where: ReturnType<typeof buildSdTicketWhere>) {
  const rows = await prisma.sdTicket.findMany({
    where,
    select: { id: true },
    orderBy: { number: 'asc' },
  })
  return rows.map((r) => r.id)
}

describe('SdTicketRepository', () => {
  describe('buildSdTicketWhere()', () => {
    it('hides closed and deleted tickets by default and scopes by workspace', async () => {
      const { workspace, flow } = await setup()
      const other = await seedWorkspace()
      const otherFlow = await seedSdPhaseFlow(other.id)
      const open = await seedSdTicket(workspace.id, flow.initial.id)
      const resolved = await seedSdTicket(workspace.id, flow.resolved.id)
      await seedSdTicket(workspace.id, flow.initial.id, { deletedAt: NOW })
      await seedSdTicket(other.id, otherFlow.initial.id)

      expect(await ids(buildSdTicketWhere(workspace.id, {}, NOW))).toEqual([
        open.id,
      ])
      expect(
        await ids(
          buildSdTicketWhere(workspace.id, { includeClosed: true }, NOW),
        ),
      ).toEqual([open.id, resolved.id])
      expect(
        await ids(
          buildSdTicketWhere(
            workspace.id,
            { phaseCategories: ['RESOLVED'] },
            NOW,
          ),
        ),
      ).toEqual([resolved.id])
      expect(
        await ids(
          buildSdTicketWhere(
            workspace.id,
            { phaseIds: [flow.resolved.id] },
            NOW,
          ),
        ),
      ).toEqual([resolved.id])
    })

    it('filters by every scalar field', async () => {
      const { workspace, user, flow } = await setup()
      const other = await seedUser()
      const p = await seedSdPriority(workspace.id, { level: 3 })
      const target = await seedSdTicket(workspace.id, flow.initial.id, {
        type: 'CHANGE',
        priorityId: p.id,
        assigneeId: user.id,
        requesterId: other.id,
        channel: 'PORTAL',
        tags: ['vip', 'rede'],
        createdAt: new Date('2026-09-10T00:00:00Z'),
        resolutionDueAt: future,
      })
      const unassigned = await seedSdTicket(workspace.id, flow.initial.id)

      const cases: Parameters<typeof buildSdTicketWhere>[1][] = [
        { types: ['CHANGE'] },
        { priorityIds: [p.id] },
        { assigneeIds: [user.id] },
        { requesterId: other.id },
        { channel: 'PORTAL' },
        { tags: ['vip'] },
        {
          createdFrom: new Date('2026-09-09'),
          createdTo: new Date('2026-09-11'),
        },
        { dueFrom: new Date('2026-09-24'), dueTo: new Date('2026-09-26') },
        { visibleToUserId: other.id },
      ]
      for (const filters of cases) {
        expect(
          await ids(buildSdTicketWhere(workspace.id, filters, NOW)),
        ).toEqual([target.id])
      }
      expect(
        await ids(
          buildSdTicketWhere(
            workspace.id,
            { createdFrom: new Date('2026-09-09') },
            NOW,
          ),
        ),
      ).toEqual([target.id, unassigned.id])
      expect(
        await ids(buildSdTicketWhere(workspace.id, { dueTo: future }, NOW)),
      ).toEqual([target.id])
      expect(
        await ids(
          buildSdTicketWhere(workspace.id, { includeUnassigned: true }, NOW),
        ),
      ).toEqual([unassigned.id])
      expect(
        await ids(
          buildSdTicketWhere(
            workspace.id,
            { assigneeIds: [user.id], includeUnassigned: true },
            NOW,
          ),
        ),
      ).toEqual([target.id, unassigned.id])
    })

    it('builds the remaining equality filters', () => {
      const where = buildSdTicketWhere(
        'ws',
        {
          severityIds: ['s'],
          impactIds: ['i'],
          urgencyIds: ['u'],
          departmentIds: ['d'],
          customerId: 'c',
          companyId: 'co',
          contactId: 'ct',
          configItemId: 'ci',
          categoryId: 'cat',
          subcategoryId: 'sub',
          serviceId: 'srv',
          classificationId: 'cl',
          parentId: null,
        },
        NOW,
      )
      expect(where).toMatchObject({
        severityId: { in: ['s'] },
        impactId: { in: ['i'] },
        urgencyId: { in: ['u'] },
        departmentId: { in: ['d'] },
        customerId: 'c',
        companyId: 'co',
        contactId: 'ct',
        configItemId: 'ci',
        categoryId: 'cat',
        subcategoryId: 'sub',
        serviceId: 'srv',
        classificationId: 'cl',
        parentId: null,
      })
      expect(
        buildSdTicketWhere('ws', { createdTo: NOW, dueFrom: NOW }, NOW),
      ).toMatchObject({
        createdAt: { lte: NOW },
        resolutionDueAt: { gte: NOW },
      })
    })

    it('filters by parent and full-text query', async () => {
      const { workspace, flow } = await setup()
      const parent = await seedSdTicket(workspace.id, flow.initial.id, {
        title: 'Rede caiu',
      })
      const child = await seedSdTicket(workspace.id, flow.initial.id, {
        parentId: parent.id,
        description: '<p>impressora travada</p>',
      })
      expect(
        await ids(
          buildSdTicketWhere(workspace.id, { parentId: parent.id }, NOW),
        ),
      ).toEqual([child.id])
      expect(
        await ids(buildSdTicketWhere(workspace.id, { parentId: null }, NOW)),
      ).toEqual([parent.id])
      expect(
        await ids(buildSdTicketWhere(workspace.id, { q: 'REDE' }, NOW)),
      ).toEqual([parent.id])
      expect(
        await ids(buildSdTicketWhere(workspace.id, { q: 'impressora' }, NOW)),
      ).toEqual([child.id])
      expect(
        await ids(
          buildSdTicketWhere(
            workspace.id,
            { q: 'INC-2', qNumber: child.number },
            NOW,
          ),
        ),
      ).toEqual([child.id])
    })

    it('applies the requester scope (requester, participant, contact user)', async () => {
      const { workspace, user, flow } = await setup()
      const contact = await seedSdContact(workspace.id, user.id, {
        userId: user.id,
      })
      const asRequester = await seedSdTicket(workspace.id, flow.initial.id, {
        requesterId: user.id,
      })
      const asParticipant = await seedSdTicket(workspace.id, flow.initial.id)
      await prisma.sdTicketParticipant.create({
        data: { ticketId: asParticipant.id, userId: user.id },
      })
      const asContact = await seedSdTicket(workspace.id, flow.initial.id, {
        contactId: contact.id,
      })
      await seedSdTicket(workspace.id, flow.initial.id)
      expect(
        await ids(
          buildSdTicketWhere(workspace.id, { visibleToUserId: user.id }, NOW),
        ),
      ).toEqual([asRequester.id, asParticipant.id, asContact.id])
    })

    it('filters by participant', async () => {
      const { workspace, user, flow } = await setup()
      const mine = await seedSdTicket(workspace.id, flow.initial.id)
      await prisma.sdTicketParticipant.create({
        data: { ticketId: mine.id, userId: user.id },
      })
      await seedSdTicket(workspace.id, flow.initial.id)
      expect(
        await ids(
          buildSdTicketWhere(workspace.id, { participantId: user.id }, NOW),
        ),
      ).toEqual([mine.id])
    })

    it('filters by SLA state', async () => {
      const { workspace, flow } = await setup()
      const flagged = await seedSdTicket(workspace.id, flow.initial.id, {
        resolutionBreached: true,
      })
      const frFlag = await seedSdTicket(workspace.id, flow.initial.id, {
        firstResponseBreached: true,
      })
      const overdueFr = await seedSdTicket(workspace.id, flow.initial.id, {
        firstResponseDueAt: past,
      })
      const overdueRes = await seedSdTicket(workspace.id, flow.initial.id, {
        resolutionDueAt: past,
      })
      await seedSdTicket(workspace.id, flow.initial.id, {
        resolutionDueAt: past,
        slaPausedAt: past,
      })
      const risk = await seedSdTicket(workspace.id, flow.initial.id, {
        slaAtRiskNotifiedAt: past,
        resolutionDueAt: future,
      })
      await seedSdTicket(workspace.id, flow.initial.id, {
        slaAtRiskNotifiedAt: past,
        resolutionBreached: true,
      })
      expect(
        await ids(buildSdTicketWhere(workspace.id, { sla: 'breached' }, NOW)),
      ).toEqual(
        expect.arrayContaining([
          flagged.id,
          frFlag.id,
          overdueFr.id,
          overdueRes.id,
        ]),
      )
      expect(
        (await ids(buildSdTicketWhere(workspace.id, { sla: 'breached' }, NOW)))
          .length,
      ).toBe(5)
      expect(
        await ids(buildSdTicketWhere(workspace.id, { sla: 'at_risk' }, NOW)),
      ).toEqual([risk.id])
    })
  })

  describe('sdTicketOrderBy()', () => {
    it('sorts by priority level, due dates with nulls last and scalars', async () => {
      const { workspace, flow } = await setup()
      const p1 = await seedSdPriority(workspace.id, { level: 1 })
      const p4 = await seedSdPriority(workspace.id, { level: 4 })
      const low = await seedSdTicket(workspace.id, flow.initial.id, {
        priorityId: p1.id,
        resolutionDueAt: future,
        title: 'b',
      })
      const high = await seedSdTicket(workspace.id, flow.initial.id, {
        priorityId: p4.id,
        resolutionDueAt: past,
        title: 'a',
      })
      const none = await seedSdTicket(workspace.id, flow.initial.id, {
        title: 'c',
      })
      const where = buildSdTicketWhere(workspace.id, {}, NOW)
      const run = async (
        field: Parameters<typeof sdTicketOrderBy>[0]['field'],
        order: 'asc' | 'desc',
      ) =>
        (
          await prisma.sdTicket.findMany({
            where,
            orderBy: sdTicketOrderBy({ field, order }),
            select: { id: true },
          })
        ).map((r) => r.id)

      // Postgres: NULL vem primeiro em DESC — só a ordem relativa importa.
      expect(
        (await run('priority', 'desc')).filter((id) => id !== none.id),
      ).toEqual([high.id, low.id])
      expect(await run('resolutionDueAt', 'asc')).toEqual([
        high.id,
        low.id,
        none.id,
      ])
      expect(await run('resolutionDueAt', 'desc')).toEqual([
        low.id,
        high.id,
        none.id,
      ])
      expect(await run('firstResponseDueAt', 'asc')).toHaveLength(3)
      expect(await run('title', 'asc')).toEqual([high.id, low.id, none.id])
      expect(sdTicketOrderBy({ field: 'number', order: 'asc' })).toEqual([
        { number: 'asc' },
        { id: 'asc' },
      ])
    })
  })

  describe('find*()', () => {
    it('finds by id and number with relations, scoped to the workspace', async () => {
      const { workspace, flow } = await setup()
      const other = await seedWorkspace()
      const t = await seedSdTicket(workspace.id, flow.initial.id)
      await seedSdTicket(workspace.id, flow.initial.id, { parentId: t.id })

      const byId = expectOk(
        await SdTicketRepository.findById(t.id, workspace.id),
      )
      expect(byId.phase.name).toBe('Novo')
      expect(byId._count.children).toBe(1)
      expect(
        expectOk(await SdTicketRepository.findByNumber(t.number, workspace.id))
          .id,
      ).toBe(t.id)
      expect(expectOk(await SdTicketRepository.findByIdUnscoped(t.id)).id).toBe(
        t.id,
      )
      expectErr(
        await SdTicketRepository.findById(t.id, other.id),
        'SD_TICKET_NOT_FOUND',
      )
      expectErr(
        await SdTicketRepository.findByNumber(999, workspace.id),
        'SD_TICKET_NOT_FOUND',
      )
      expectErr(
        await SdTicketRepository.findByIdUnscoped('missing'),
        'SD_TICKET_NOT_FOUND',
      )
    })
  })

  describe('list()', () => {
    it('paginates by page and by cursor', async () => {
      const { workspace, flow } = await setup()
      const tickets = []
      for (let i = 0; i < 5; i++) {
        tickets.push(await seedSdTicket(workspace.id, flow.initial.id))
      }
      const where = buildSdTicketWhere(workspace.id, {}, NOW)
      const sort = { field: 'number' as const, order: 'asc' as const }

      const first = expectOk(
        await SdTicketRepository.list({ where, sort, page: 1, pageSize: 2 }),
      )
      expect(first.items.map((t) => t.id)).toEqual([
        tickets[0].id,
        tickets[1].id,
      ])
      expect(first.total).toBe(5)
      expect(first.nextCursor).toBe(tickets[1].id)

      const second = expectOk(
        await SdTicketRepository.list({ where, sort, page: 3, pageSize: 2 }),
      )
      expect(second.items.map((t) => t.id)).toEqual([tickets[4].id])
      expect(second.nextCursor).toBeNull()

      const cursor = expectOk(
        await SdTicketRepository.list({
          where,
          sort,
          page: 1,
          pageSize: 2,
          cursor: first.nextCursor as string,
        }),
      )
      expect(cursor.items.map((t) => t.id)).toEqual([
        tickets[2].id,
        tickets[3].id,
      ])
    })
  })

  describe('kanban() and count()', () => {
    it('returns per-phase counts and capped items', async () => {
      const { workspace, flow } = await setup()
      await seedSdTicket(workspace.id, flow.initial.id)
      await seedSdTicket(workspace.id, flow.initial.id)
      await seedSdTicket(workspace.id, flow.inProgress.id)
      const where = buildSdTicketWhere(
        workspace.id,
        { includeClosed: true },
        NOW,
      )
      const columns = expectOk(
        await SdTicketRepository.kanban({
          where,
          phaseIds: [flow.initial.id, flow.inProgress.id, flow.closed.id],
          sort: { field: 'createdAt', order: 'desc' },
          take: 1,
        }),
      )
      expect(columns.map((c) => [c.count, c.items.length])).toEqual([
        [2, 1],
        [1, 1],
        [0, 0],
      ])
      expect(expectOk(await SdTicketRepository.count(where))).toBe(3)
    })
  })

  describe('summary()', () => {
    it('counts the home page numbers, optionally scoped', async () => {
      const { workspace, user, flow } = await setup()
      await seedSdTicket(workspace.id, flow.initial.id, {
        assigneeId: user.id,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      })
      await seedSdTicket(workspace.id, flow.inProgress.id, {
        slaAtRiskNotifiedAt: past,
      })
      await seedSdTicket(workspace.id, flow.waiting.id, {
        resolutionBreached: true,
        requesterId: user.id,
      })
      await seedSdTicket(workspace.id, flow.resolved.id)
      await seedSdTicket(workspace.id, flow.closed.id)
      await seedSdTicket(workspace.id, flow.canceled.id)

      const s = expectOk(
        await SdTicketRepository.summary({
          workspaceId: workspace.id,
          actorId: user.id,
          todayStart: new Date('2026-09-15T00:00:00Z'),
          now: NOW,
        }),
      )
      expect(s.byPhaseCategory).toEqual({
        NEW: 1,
        IN_PROGRESS: 1,
        WAITING: 1,
        RESOLVED: 1,
        CLOSED: 1,
        CANCELED: 1,
      })
      expect(s.myOpen).toBe(1)
      expect(s.unassigned).toBe(2)
      expect(s.atRisk).toBe(1)
      expect(s.breached).toBe(1)
      expect(s.createdToday).toBe(5)

      const scoped = expectOk(
        await SdTicketRepository.summary({
          workspaceId: workspace.id,
          actorId: user.id,
          scope: { requesterId: user.id },
          todayStart: new Date('2026-09-15T00:00:00Z'),
          now: NOW,
        }),
      )
      expect(scoped.byPhaseCategory.WAITING).toBe(1)
      expect(scoped.byPhaseCategory.NEW).toBe(0)
    })
  })

  describe('createWithNumber()', () => {
    it('reserves sequential numbers atomically', async () => {
      const { workspace, flow } = await setup()
      await seedSdSettings(workspace.id, { nextTicketNumber: 41 })
      const data = {
        type: 'INCIDENT' as const,
        title: 'x',
        phaseId: flow.initial.id,
      }
      const [a, b] = await Promise.all([
        SdTicketRepository.createWithNumber(workspace.id, data),
        SdTicketRepository.createWithNumber(workspace.id, data),
      ])
      const numbers = [expectOk(a).number, expectOk(b).number].sort()
      expect(numbers).toEqual([41, 42])
      expect(expectOk(a).phase.id).toBe(flow.initial.id)
      const settings = await prisma.sdSettings.findUniqueOrThrow({
        where: { workspaceId: workspace.id },
      })
      expect(settings.nextTicketNumber).toBe(43)
    })

    it('fails without the settings row', async () => {
      const { workspace, flow } = await setup()
      expectErr(
        await SdTicketRepository.createWithNumber(workspace.id, {
          type: 'INCIDENT',
          title: 'x',
          phaseId: flow.initial.id,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('mutations', () => {
    it('updates, marks first response, touches activity and soft deletes', async () => {
      const { workspace, flow } = await setup()
      const t = await seedSdTicket(workspace.id, flow.initial.id)
      const updated = expectOk(
        await SdTicketRepository.update(t.id, { title: 'Novo título' }),
      )
      expect(updated.title).toBe('Novo título')

      expect(
        expectOk(await SdTicketRepository.markFirstResponse(t.id, NOW)),
      ).toBe(true)
      expect(
        expectOk(await SdTicketRepository.markFirstResponse(t.id, future)),
      ).toBe(false)

      expectOk(await SdTicketRepository.touchActivity(t.id, future))
      const stored = await prisma.sdTicket.findUniqueOrThrow({
        where: { id: t.id },
      })
      expect(stored.firstRespondedAt).toEqual(NOW)
      expect(stored.lastActivityAt).toEqual(future)

      expectOk(await SdTicketRepository.softDelete(t.id))
      expectErr(
        await SdTicketRepository.findById(t.id, workspace.id),
        'SD_TICKET_NOT_FOUND',
      )
    })

    it('claims SLA flags only once', async () => {
      const { workspace, flow } = await setup()
      const t = await seedSdTicket(workspace.id, flow.initial.id)
      for (const flag of [
        'firstResponseBreached',
        'resolutionBreached',
        'slaAtRisk',
      ] as const) {
        expect(
          expectOk(await SdTicketRepository.claimSlaFlag(t.id, flag, NOW)),
        ).toBe(true)
        expect(
          expectOk(await SdTicketRepository.claimSlaFlag(t.id, flag, NOW)),
        ).toBe(false)
      }
      const stored = await prisma.sdTicket.findUniqueOrThrow({
        where: { id: t.id },
      })
      expect(stored).toMatchObject({
        firstResponseBreached: true,
        resolutionBreached: true,
        slaAtRiskNotifiedAt: NOW,
      })
    })

    it('detects descendants in the ticket tree', async () => {
      const { workspace, flow } = await setup()
      const root = await seedSdTicket(workspace.id, flow.initial.id)
      const child = await seedSdTicket(workspace.id, flow.initial.id, {
        parentId: root.id,
      })
      const grandchild = await seedSdTicket(workspace.id, flow.initial.id, {
        parentId: child.id,
      })
      const other = await seedSdTicket(workspace.id, flow.initial.id)
      expect(
        expectOk(
          await SdTicketRepository.isDescendantOrSelf(root.id, grandchild.id),
        ),
      ).toBe(true)
      expect(
        expectOk(await SdTicketRepository.isDescendantOrSelf(root.id, root.id)),
      ).toBe(true)
      expect(
        expectOk(
          await SdTicketRepository.isDescendantOrSelf(root.id, other.id),
        ),
      ).toBe(false)
      expect(
        expectOk(
          await SdTicketRepository.isDescendantOrSelf(root.id, 'missing'),
        ),
      ).toBe(false)
    })
  })

  describe('worker queries', () => {
    it('lists open tickets in id batches', async () => {
      const { workspace, flow } = await setup()
      const a = await seedSdTicket(workspace.id, flow.initial.id)
      const b = await seedSdTicket(workspace.id, flow.waiting.id)
      await seedSdTicket(workspace.id, flow.resolved.id)
      const all = expectOk(
        await SdTicketRepository.listOpenForSla(workspace.id, null, 10),
      )
      const sorted = [a.id, b.id].sort()
      expect(all.map((t) => t.id)).toEqual(sorted)
      const next = expectOk(
        await SdTicketRepository.listOpenForSla(workspace.id, sorted[0], 10),
      )
      expect(next.map((t) => t.id)).toEqual([sorted[1]])
    })

    it('lists resolved tickets past the cutoff, optionally only signed ones', async () => {
      const { workspace, user, flow } = await setup()
      const old = await seedSdTicket(workspace.id, flow.resolved.id, {
        resolvedAt: past,
      })
      const signed = await seedSdTicket(workspace.id, flow.resolved.id, {
        resolvedAt: new Date('2026-09-19T12:00:00Z'),
      })
      await seedSdTicket(workspace.id, flow.resolved.id, { resolvedAt: future })
      await seedSdTicket(workspace.id, flow.closed.id, { resolvedAt: past })
      await prisma.sdTicketSignature.create({
        data: {
          workspaceId: workspace.id,
          ticketId: signed.id,
          signerName: 'Fulano',
          signedById: user.id,
          storageKey: 'k',
          imageSha256: 'a',
          ticketSha256: 'b',
        },
      })
      expect(
        expectOk(
          await SdTicketRepository.listResolvedBefore(workspace.id, NOW, 10),
        ).map((t) => t.id),
      ).toEqual([signed.id, old.id])
      expect(
        expectOk(
          await SdTicketRepository.listResolvedBefore(
            workspace.id,
            NOW,
            10,
            true,
          ),
        ).map((t) => t.id),
      ).toEqual([signed.id])
    })
  })

  describe('database errors', () => {
    it('maps every failure to DATABASE_ERROR', async () => {
      const boom = () => Promise.reject(new Error('boom'))
      const spies = [
        vi
          .spyOn(prisma.sdTicket, 'findFirst')
          .mockImplementation(boom as never),
        vi.spyOn(prisma.sdTicket, 'findMany').mockImplementation(boom as never),
        vi.spyOn(prisma.sdTicket, 'count').mockImplementation(boom as never),
        vi.spyOn(prisma.sdTicket, 'update').mockImplementation(boom as never),
        vi
          .spyOn(prisma.sdTicket, 'updateMany')
          .mockImplementation(boom as never),
        vi
          .spyOn(prisma.sdTicket, 'findUnique')
          .mockImplementation(boom as never),
      ]
      const where = { workspaceId: 'w' }
      const sort = { field: 'createdAt' as const, order: 'desc' as const }
      const results = await Promise.all([
        SdTicketRepository.findById('t', 'w'),
        SdTicketRepository.findByNumber(1, 'w'),
        SdTicketRepository.findByIdUnscoped('t'),
        SdTicketRepository.list({ where, sort, page: 1, pageSize: 1 }),
        SdTicketRepository.kanban({ where, phaseIds: ['p'], sort, take: 1 }),
        SdTicketRepository.count(where),
        SdTicketRepository.summary({
          workspaceId: 'w',
          actorId: 'u',
          todayStart: NOW,
          now: NOW,
        }),
        SdTicketRepository.update('t', {}),
        SdTicketRepository.markFirstResponse('t', NOW),
        SdTicketRepository.touchActivity('t', NOW),
        SdTicketRepository.softDelete('t'),
        SdTicketRepository.isDescendantOrSelf('t', 'p'),
        SdTicketRepository.claimSlaFlag('t', 'slaAtRisk', NOW),
        SdTicketRepository.listOpenForSla('w', null, 1),
        SdTicketRepository.listResolvedBefore('w', NOW, 1),
      ])
      for (const result of results) expectErr(result, 'DATABASE_ERROR')
      for (const spy of spies) spy.mockRestore()
    })
  })
})
