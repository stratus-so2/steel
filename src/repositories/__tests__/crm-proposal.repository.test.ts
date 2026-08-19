import { describe, expect, it } from 'vitest'
import { seedCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
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
