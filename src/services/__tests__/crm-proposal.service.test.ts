import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-proposal.repository')
vi.mock('@/src/repositories/crm-document-template.repository')

import { CrmDocumentTemplateRepository } from '@/src/repositories/crm-document-template.repository'
import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '@/src/repositories/crm-proposal.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmProposalService } from '../crm-proposal.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProposalRepo = vi.mocked(CrmProposalRepository)
const mockedViewRepo = vi.mocked(CrmProposalViewRepository)
const mockedDocumentTemplateRepo = vi.mocked(CrmDocumentTemplateRepository)

describe('CrmProposalService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmProposalService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should default the title when none is given', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedProposalRepo.create.mockResolvedValue(
        ok(createFakeCrmProposal({ id: 'p1', title: 'Documento sem título' })),
      )

      expectOk(
        await CrmProposalService.create('u1', 'ws1', { type: 'PROPOSAL' }),
      )
      expect(mockedProposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Documento sem título', content: '' }),
      )
    })

    it('should copy content/contentJson from the template of the same type', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedDocumentTemplateRepo.findById.mockResolvedValue(
        ok({
          id: 't1',
          title: 'Template X',
          content: '<p>modelo</p>',
          contentJson: '{"type":"doc"}',
          type: 'PROPOSAL',
          workspaceId: 'ws1',
          createdById: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      )
      mockedProposalRepo.create.mockResolvedValue(
        ok(createFakeCrmProposal({ id: 'p1', title: 'Template X' })),
      )

      expectOk(
        await CrmProposalService.create('u1', 'ws1', {
          type: 'PROPOSAL',
          templateId: 't1',
        }),
      )
      expect(mockedProposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Template X',
          content: '<p>modelo</p>',
          contentJson: '{"type":"doc"}',
        }),
      )
    })

    it('should reject a template of a different type', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedDocumentTemplateRepo.findById.mockResolvedValue(
        ok({
          id: 't1',
          title: 'Template X',
          content: '',
          contentJson: null,
          type: 'CONTRACT',
          workspaceId: 'ws1',
          createdById: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      )

      expectErr(
        await CrmProposalService.create('u1', 'ws1', {
          type: 'PROPOSAL',
          templateId: 't1',
        }),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('update()', () => {
    it('should stamp publishedAt on the first publish', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const existing = createFakeCrmProposal({
        id: 'p1',
        status: 'DRAFT',
        publishedAt: null,
      })
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedProposalRepo.update.mockResolvedValue(
        ok({ ...existing, status: 'PUBLISHED', publishedAt: new Date() }),
      )

      expectOk(
        await CrmProposalService.update('u1', 'ws1', 'p1', {
          status: 'PUBLISHED',
        }),
      )
      expect(mockedProposalRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        }),
      )
    })

    it('should not overwrite publishedAt when re-publishing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const originalPublishedAt = new Date('2026-01-01T00:00:00Z')
      const existing = createFakeCrmProposal({
        id: 'p1',
        status: 'DRAFT',
        publishedAt: originalPublishedAt,
      })
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedProposalRepo.update.mockResolvedValue(ok(existing))

      expectOk(
        await CrmProposalService.update('u1', 'ws1', 'p1', {
          status: 'PUBLISHED',
        }),
      )
      expect(mockedProposalRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ publishedAt: undefined }),
      )
    })
  })

  describe('getPublicByShareToken()', () => {
    it('should return the public shape without auth', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(createFakeCrmProposal({ id: 'p1', shareToken: 'tok' })),
      )

      const dto = expectOk(
        await CrmProposalService.getPublicByShareToken('tok'),
      )
      expect(dto.id).toBe('p1')
      expect(dto).not.toHaveProperty('shareToken')
    })
  })

  describe('recordView()', () => {
    it('should hash the ip before recording', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(createFakeCrmProposal({ id: 'p1', shareToken: 'tok' })),
      )
      mockedViewRepo.record.mockResolvedValue(
        ok({
          id: 'v1',
          proposalId: 'p1',
          viewId: 'view1',
          ipHash: 'hashed',
          durationMs: 0,
          reachedEnd: false,
          scrolledPct: 0,
          referrer: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      expectOk(
        await CrmProposalService.recordView('tok', '1.2.3.4', {
          viewId: 'view1',
          durationMs: 0,
          reachedEnd: false,
          scrolledPct: 0,
        }),
      )
      expect(mockedViewRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          ipHash: expect.not.stringContaining('1.2.3.4'),
        }),
      )
    })
  })
})
