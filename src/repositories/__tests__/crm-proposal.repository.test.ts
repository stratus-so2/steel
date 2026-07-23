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
    it('should assign a unique shareToken', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const result = await CrmProposalRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        title: 'Proposta X',
      })

      const proposal = expectOk(result)
      expect(proposal.shareToken).toBeTruthy()
      expect(proposal.status).toBe('DRAFT')
    })
  })

  describe('setPublished()', () => {
    it('should set status and publishedAt', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id)

      const result = await CrmProposalRepository.setPublished(proposal.id, true)

      const published = expectOk(result)
      expect(published.status).toBe('PUBLISHED')
      expect(published.publishedAt).not.toBeNull()
    })
  })

  describe('findByShareToken()', () => {
    it('should only find published proposals', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const proposal = await seedCrmProposal(workspace.id, user.id)

      expectErr(
        await CrmProposalRepository.findByShareToken(proposal.shareToken),
        'RESOURCE_NOT_FOUND',
      )

      await CrmProposalRepository.setPublished(proposal.id, true)

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
