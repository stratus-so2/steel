import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedCrmLead } from '@/src/__tests__/factories/crm-lead.factory'
import {
  seedCrmProposal,
  seedCrmProposalSection,
  seedCrmProposalView,
} from '@/src/__tests__/factories/crm-proposal.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '../crm-proposal.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CrmProposalRepository — reads and lifecycle', () => {
  it('listByWorkspace() orders by position, counts views and hides deleted/foreign rows', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const second = await seedCrmProposal(workspace.id, user.id, {
      position: 1,
    })
    const first = await seedCrmProposal(workspace.id, user.id, { position: 0 })
    await seedCrmProposal(workspace.id, user.id, {
      position: 2,
      deletedAt: new Date(),
    })
    await seedCrmProposal(other.id, user.id)
    await seedCrmProposalView(second.id)
    await seedCrmProposalView(second.id)

    const list = expectOk(
      await CrmProposalRepository.listByWorkspace(workspace.id),
    )
    expect(list.map((p) => p.id)).toEqual([first.id, second.id])
    expect(list[1]._count.views).toBe(2)
  })

  it('findById() returns sections ordered and respects workspace scope', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const proposal = await seedCrmProposal(workspace.id, user.id)
    await seedCrmProposalSection(proposal.id, {
      type: 'TERMS_CONDITIONS',
      order: 1,
    })
    await seedCrmProposalSection(proposal.id, { type: 'COVER', order: 0 })

    const found = expectOk(
      await CrmProposalRepository.findById(proposal.id, workspace.id),
    )
    expect(found.sections.map((s) => s.type)).toEqual([
      'COVER',
      'TERMS_CONDITIONS',
    ])
    expectErr(
      await CrmProposalRepository.findById(proposal.id, other.id),
      'CRM_PROPOSAL_NOT_FOUND',
    )
  })

  it('findById() does not return a soft-deleted proposal', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const proposal = await seedCrmProposal(workspace.id, user.id)

    expectOk(await CrmProposalRepository.softDelete(proposal.id))

    expectErr(
      await CrmProposalRepository.findById(proposal.id, workspace.id),
      'CRM_PROPOSAL_NOT_FOUND',
    )
  })

  it('findLatestByLeadId() returns the newest live proposal of the lead or null', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const lead = await seedCrmLead(workspace.id, user.id)
    const older = await seedCrmProposal(workspace.id, user.id, {
      leadId: lead.id,
    })
    await prisma.crmProposal.update({
      where: { id: older.id },
      data: { createdAt: new Date('2020-01-01') },
    })
    const newer = await seedCrmProposal(workspace.id, user.id, {
      leadId: lead.id,
    })

    expect(
      expectOk(
        await CrmProposalRepository.findLatestByLeadId(lead.id, workspace.id),
      )?.id,
    ).toBe(newer.id)

    await CrmProposalRepository.softDelete(newer.id)
    expect(
      expectOk(
        await CrmProposalRepository.findLatestByLeadId(lead.id, workspace.id),
      )?.id,
    ).toBe(older.id)
    expect(
      expectOk(
        await CrmProposalRepository.findLatestByLeadId('none', workspace.id),
      ),
    ).toBeNull()
  })

  it('create() appends after existing proposals', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    await seedCrmProposal(workspace.id, user.id)

    const created = expectOk(
      await CrmProposalRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Segunda',
        responsibleId: user.id,
        sections: [],
      }),
    )
    expect(created.position).toBe(1)
  })

  it('update() without sections keeps the existing ones', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const proposal = await seedCrmProposal(workspace.id, user.id)
    await seedCrmProposalSection(proposal.id)

    const updated = expectOk(
      await CrmProposalRepository.update(proposal.id, { name: 'Renomeada' }),
    )
    expect(updated.name).toBe('Renomeada')
    expect(updated.sections).toHaveLength(1)
  })

  it('reorder() rewrites positions within the workspace', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const a = await seedCrmProposal(workspace.id, user.id, { position: 0 })
    const b = await seedCrmProposal(workspace.id, user.id, { position: 1 })

    expectOk(await CrmProposalRepository.reorder(workspace.id, [b.id, a.id]))

    const list = expectOk(
      await CrmProposalRepository.listByWorkspace(workspace.id),
    )
    expect(list.map((p) => p.id)).toEqual([b.id, a.id])
  })

  it('reorder() fails atomically for a proposal of another workspace', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const own = await seedCrmProposal(workspace.id, user.id, { position: 5 })
    const foreign = await seedCrmProposal(other.id, user.id, { position: 3 })

    expectErr(
      await CrmProposalRepository.reorder(workspace.id, [own.id, foreign.id]),
      'DATABASE_ERROR',
    )
    const stored = await prisma.crmProposal.findUniqueOrThrow({
      where: { id: own.id },
    })
    expect(stored.position).toBe(5)
  })
})

describe('CrmProposalRepository — database failures', () => {
  it('returns DATABASE_ERROR for writes on missing rows or FKs', async () => {
    const user = await seedUser()
    expectErr(
      await CrmProposalRepository.create({
        workspaceId: 'missing',
        createdById: user.id,
        name: 'x',
        responsibleId: user.id,
        sections: [],
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalRepository.update('missing', { name: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalRepository.setStatus('missing', 'SENT'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalRepository.softDelete('missing'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalViewRepository.record({
        proposalId: 'missing',
        viewId: 'v',
        ipHash: 'h',
      }),
      'DATABASE_ERROR',
    )
  })

  it('returns DATABASE_ERROR when reads throw', async () => {
    vi.spyOn(prisma.crmProposal, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.crmProposal, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.crmProposal, 'updateMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.crmProposalView, 'count').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmProposalView, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmProposalView, 'aggregate').mockRejectedValueOnce(
      new Error('boom'),
    )

    expectErr(
      await CrmProposalRepository.listByWorkspace('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalRepository.listExpirationCandidates(new Date()),
      'DATABASE_ERROR',
    )
    expectErr(await CrmProposalRepository.findById('p', 'w'), 'DATABASE_ERROR')
    expectErr(
      await CrmProposalRepository.findLatestByLeadId('l', 'w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalRepository.findByShareToken('t'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalRepository.markExpired('p', new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalRepository.accept('p', { name: 'x', at: new Date() }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalViewRepository.countByProposal('p'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmProposalViewRepository.listByProposal('p'),
      'DATABASE_ERROR',
    )
    expectErr(await CrmProposalViewRepository.metricsFor('p'), 'DATABASE_ERROR')
  })
})

describe('CrmProposalViewRepository — reads', () => {
  it('listByProposal() returns only the proposal views, newest first', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const proposal = await seedCrmProposal(workspace.id, user.id)
    const other = await seedCrmProposal(workspace.id, user.id)
    const older = await seedCrmProposalView(proposal.id)
    await prisma.crmProposalView.update({
      where: { id: older.id },
      data: { createdAt: new Date('2020-01-01') },
    })
    const newer = await seedCrmProposalView(proposal.id)
    await seedCrmProposalView(other.id)

    const views = expectOk(
      await CrmProposalViewRepository.listByProposal(proposal.id),
    )
    expect(views.map((v) => v.id)).toEqual([newer.id, older.id])
  })

  it('metricsFor() aggregates views, unique visitors, completion and avg duration', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const proposal = await seedCrmProposal(workspace.id, user.id)
    await CrmProposalViewRepository.record({
      proposalId: proposal.id,
      viewId: 'a',
      ipHash: 'ip-1',
      durationMs: 1000,
      reachedEnd: true,
    })
    await CrmProposalViewRepository.record({
      proposalId: proposal.id,
      viewId: 'b',
      ipHash: 'ip-1',
      durationMs: 2001,
    })
    await CrmProposalViewRepository.record({
      proposalId: proposal.id,
      viewId: 'c',
      ipHash: 'ip-2',
      durationMs: 3000,
      reachedEnd: true,
    })

    const metrics = expectOk(
      await CrmProposalViewRepository.metricsFor(proposal.id),
    )
    expect(metrics).toMatchObject({
      totalViews: 3,
      uniqueVisitors: 2,
      completed: 2,
      avgDurationMs: 2000,
    })
    expect(metrics.views).toHaveLength(3)
  })

  it('metricsFor() reports zeros for a proposal without views', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const proposal = await seedCrmProposal(workspace.id, user.id)

    expect(
      expectOk(await CrmProposalViewRepository.metricsFor(proposal.id)),
    ).toEqual({
      totalViews: 0,
      uniqueVisitors: 0,
      completed: 0,
      avgDurationMs: 0,
      views: [],
    })
  })
})

describe('CrmProposalRepository', () => {
  describe('create()', () => {
    it('should assign a unique shareToken and persist sections', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const result = await CrmProposalRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Proposta X',
        responsibleId: user.id,
        sections: [
          {
            type: 'COVER',
            order: 0,
            enabled: true,
            content: { type: 'COVER', title: 'Proposta X' },
          },
        ],
      })

      const proposal = expectOk(result)
      expect(proposal.shareToken).toBeTruthy()
      expect(proposal.status).toBe('DRAFT')
      expect(proposal.sections).toHaveLength(1)
      expect(proposal.sections[0].type).toBe('COVER')
    })
  })

  describe('update()', () => {
    it('should replace all sections when sections are provided', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const created = expectOk(
        await CrmProposalRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Proposta X',
          responsibleId: user.id,
          sections: [
            {
              type: 'COVER',
              order: 0,
              enabled: true,
              content: { type: 'COVER', title: 'V1' },
            },
          ],
        }),
      )

      const updated = expectOk(
        await CrmProposalRepository.update(created.id, {
          sections: [
            {
              type: 'COVER',
              order: 0,
              enabled: true,
              content: { type: 'COVER', title: 'V2' },
            },
            {
              type: 'TERMS_CONDITIONS',
              order: 1,
              enabled: true,
              content: { type: 'TERMS_CONDITIONS', text: 'Termos' },
            },
          ],
        }),
      )

      expect(updated.sections).toHaveLength(2)
      expect(updated.sections.find((s) => s.type === 'COVER')?.content).toEqual(
        { type: 'COVER', title: 'V2' },
      )
    })
  })

  describe('setStatus()', () => {
    it('should transition status', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id)

      const result = await CrmProposalRepository.setStatus(proposal.id, 'SENT')

      const sent = expectOk(result)
      expect(sent.status).toBe('SENT')
    })
  })

  describe('findByShareToken()', () => {
    it('should not find a proposal still in DRAFT', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id)

      expectErr(
        await CrmProposalRepository.findByShareToken(proposal.shareToken),
        'CRM_PROPOSAL_NOT_FOUND',
      )

      await CrmProposalRepository.setStatus(proposal.id, 'SENT')

      const found = expectOk(
        await CrmProposalRepository.findByShareToken(proposal.shareToken),
      )
      expect(found.id).toBe(proposal.id)
    })
  })
})

describe('CrmProposalRepository — validity', () => {
  const past = new Date('2026-01-10T15:00:00.000Z')
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)

  describe('listExpirationCandidates()', () => {
    it('should list sent/viewed proposals whose validity date has passed', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const due = await seedCrmProposal(workspace.id, user.id, {
        status: 'SENT',
        validUntil: past,
      })
      const viewed = await seedCrmProposal(workspace.id, user.id, {
        status: 'VIEWED',
        validUntil: past,
      })
      await Promise.all([
        seedCrmProposal(workspace.id, user.id, {
          status: 'SENT',
          validUntil: future,
        }),
        seedCrmProposal(workspace.id, user.id, {
          status: 'SENT',
          validUntil: null,
        }),
        seedCrmProposal(workspace.id, user.id, {
          status: 'DRAFT',
          validUntil: past,
        }),
        seedCrmProposal(workspace.id, user.id, {
          status: 'ACCEPTED',
          validUntil: past,
        }),
        seedCrmProposal(workspace.id, user.id, {
          status: 'SENT',
          validUntil: past,
          deletedAt: new Date(),
        }),
      ])

      const candidates = expectOk(
        await CrmProposalRepository.listExpirationCandidates(new Date()),
      )

      expect(candidates.map((c) => c.id).sort()).toEqual(
        [due.id, viewed.id].sort(),
      )
      expect(candidates[0]?.responsible.email).toBe(user.email)
      expect(candidates[0]?.workspace.slug).toBe(workspace.slug)
    })
  })

  describe('markExpired()', () => {
    it('should expire a sent proposal once and stamp expiredAt', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id, {
        status: 'VIEWED',
        validUntil: past,
      })
      const at = new Date()

      expect(
        expectOk(await CrmProposalRepository.markExpired(proposal.id, at)),
      ).toBe(true)
      expect(
        expectOk(await CrmProposalRepository.markExpired(proposal.id, at)),
      ).toBe(false)

      const stored = await prisma.crmProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      })
      expect(stored.status).toBe('EXPIRED')
      expect(stored.expiredAt).toEqual(at)
    })

    it('should not expire an accepted proposal', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id, {
        status: 'ACCEPTED',
        validUntil: past,
      })

      expect(
        expectOk(
          await CrmProposalRepository.markExpired(proposal.id, new Date()),
        ),
      ).toBe(false)
    })
  })

  describe('accept()', () => {
    it('should record the acceptance of a sent proposal only once', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id, {
        status: 'VIEWED',
      })
      const at = new Date()

      expect(
        expectOk(
          await CrmProposalRepository.accept(proposal.id, {
            name: 'Maria',
            at,
          }),
        ),
      ).toBe(true)
      expect(
        expectOk(
          await CrmProposalRepository.accept(proposal.id, {
            name: 'Outra',
            at,
          }),
        ),
      ).toBe(false)

      const stored = await prisma.crmProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      })
      expect(stored.status).toBe('ACCEPTED')
      expect(stored.acceptedByName).toBe('Maria')
      expect(stored.acceptedAt).toEqual(at)
    })
  })

  describe('update() with expiredAt', () => {
    it('should clear expiredAt when validity is extended', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id, {
        status: 'EXPIRED',
        validUntil: past,
        expiredAt: new Date(),
      })

      const updated = expectOk(
        await CrmProposalRepository.update(proposal.id, {
          validUntil: future,
          status: 'SENT',
          expiredAt: null,
        }),
      )
      expect(updated.status).toBe('SENT')
      expect(updated.expiredAt).toBeNull()
    })
  })
})

describe('CrmProposalViewRepository.countByProposal()', () => {
  it('should count the views of a proposal', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const proposal = await seedCrmProposal(workspace.id, user.id, {
      status: 'VIEWED',
    })
    await CrmProposalViewRepository.record({
      proposalId: proposal.id,
      viewId: 'v1',
      ipHash: 'h',
      durationMs: 0,
      reachedEnd: false,
      scrolledPct: 0,
    })

    expect(
      expectOk(await CrmProposalViewRepository.countByProposal(proposal.id)),
    ).toBe(1)
  })
})

describe('CrmProposalViewRepository', () => {
  describe('record()', () => {
    it('should upsert a view by proposalId+viewId', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id)

      const created = expectOk(
        await CrmProposalViewRepository.record({
          proposalId: proposal.id,
          viewId: 'v1',
          ipHash: 'hash',
        }),
      )

      const updated = expectOk(
        await CrmProposalViewRepository.record({
          proposalId: proposal.id,
          viewId: 'v1',
          ipHash: 'hash',
          durationMs: 5000,
        }),
      )

      expect(updated.id).toBe(created.id)
      expect(updated.durationMs).toBe(5000)
    })
  })
})
