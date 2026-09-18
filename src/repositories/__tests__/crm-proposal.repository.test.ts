import { describe, expect, it } from 'vitest'
import { seedCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '../crm-proposal.repository'

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
