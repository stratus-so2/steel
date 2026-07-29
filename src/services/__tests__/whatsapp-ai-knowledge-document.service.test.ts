import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppAiKnowledgeDocument } from '@/src/__tests__/factories/whatsapp-ai-knowledge-document.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-ai-knowledge-document.repository')
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: vi.fn(async () => undefined),
  putObject: vi.fn(async () => undefined),
  deleteObject: vi.fn(async () => undefined),
}))
vi.mock('@/src/lib/whatsapp/knowledge-document', () => ({
  classifyKnowledgeDocument: vi.fn(),
  extractKnowledgeDocumentText: vi.fn(),
}))

import { deleteObject, putObject } from '@/src/lib/storage/s3'
import {
  classifyKnowledgeDocument,
  extractKnowledgeDocumentText,
} from '@/src/lib/whatsapp/knowledge-document'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppAiKnowledgeDocumentRepository } from '@/src/repositories/whatsapp-ai-knowledge-document.repository'
import { WhatsAppAiKnowledgeDocumentService } from '../whatsapp-ai-knowledge-document.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedRepo = vi.mocked(WhatsAppAiKnowledgeDocumentRepository)
const mockedClassify = vi.mocked(classifyKnowledgeDocument)
const mockedExtract = vi.mocked(extractKnowledgeDocumentText)
const mockedPutObject = vi.mocked(putObject)
const mockedDeleteObject = vi.mocked(deleteObject)

describe('WhatsAppAiKnowledgeDocumentService', () => {
  describe('list()', () => {
    it('should reject a plain MEMBER', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )

      expectErr(
        await WhatsAppAiKnowledgeDocumentService.list('u1', 'ws1'),
        'FORBIDDEN',
      )
    })

    it('should list documents for a privileged member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeWhatsAppAiKnowledgeDocument({ id: 'doc1' })]),
      )

      const result = await WhatsAppAiKnowledgeDocumentService.list('u1', 'ws1')

      const list = expectOk(result)
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe('doc1')
    })
  })

  describe('upload()', () => {
    it('should reject an unsupported file type before touching storage', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedClassify.mockReturnValue({
        ok: false,
        error: {
          code: 'WHATSAPP_AI_KNOWLEDGE_DOCUMENT_UNSUPPORTED_TYPE',
          message: 'unsupported',
        },
      })

      const result = await WhatsAppAiKnowledgeDocumentService.upload(
        'u1',
        'ws1',
        {
          contentType: 'image/png',
          byteSize: 100,
          filename: 'foto.png',
          readBody: async () => Buffer.from(''),
        },
      )

      expectErr(result, 'WHATSAPP_AI_KNOWLEDGE_DOCUMENT_UNSUPPORTED_TYPE')
      expect(mockedPutObject).not.toHaveBeenCalled()
    })

    it('should mark the document READY when extraction succeeds', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedClassify.mockReturnValue({ ok: true, value: { ext: 'pdf' } })
      mockedRepo.create.mockResolvedValue(
        ok(
          createFakeWhatsAppAiKnowledgeDocument({
            id: 'doc1',
            status: 'PROCESSING',
          }),
        ),
      )
      mockedExtract.mockResolvedValue({ ok: true, value: 'texto extraído' })
      mockedRepo.updateStatus.mockResolvedValue(
        ok(
          createFakeWhatsAppAiKnowledgeDocument({
            id: 'doc1',
            status: 'READY',
          }),
        ),
      )

      const result = await WhatsAppAiKnowledgeDocumentService.upload(
        'u1',
        'ws1',
        {
          contentType: 'application/pdf',
          byteSize: 100,
          filename: 'manual.pdf',
          readBody: async () => Buffer.from('conteúdo'),
        },
      )

      const dto = expectOk(result)
      expect(dto.status).toBe('READY')
      expect(mockedRepo.updateStatus).toHaveBeenCalledWith('doc1', {
        status: 'READY',
        extractedText: 'texto extraído',
      })
    })

    it('should mark the document FAILED when extraction fails', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedClassify.mockReturnValue({ ok: true, value: { ext: 'pdf' } })
      mockedRepo.create.mockResolvedValue(
        ok(createFakeWhatsAppAiKnowledgeDocument({ id: 'doc1' })),
      )
      mockedExtract.mockResolvedValue({ ok: false, error: 'pdf corrompido' })
      mockedRepo.updateStatus.mockResolvedValue(
        ok(
          createFakeWhatsAppAiKnowledgeDocument({
            id: 'doc1',
            status: 'FAILED',
            errorMessage: 'pdf corrompido',
          }),
        ),
      )

      const result = await WhatsAppAiKnowledgeDocumentService.upload(
        'u1',
        'ws1',
        {
          contentType: 'application/pdf',
          byteSize: 100,
          filename: 'manual.pdf',
          readBody: async () => Buffer.from('lixo'),
        },
      )

      const dto = expectOk(result)
      expect(dto.status).toBe('FAILED')
      expect(mockedRepo.updateStatus).toHaveBeenCalledWith('doc1', {
        status: 'FAILED',
        errorMessage: 'pdf corrompido',
      })
    })
  })

  describe('remove()', () => {
    it('should reject a plain MEMBER', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )

      expectErr(
        await WhatsAppAiKnowledgeDocumentService.remove('u1', 'ws1', 'doc1'),
        'FORBIDDEN',
      )
    })

    it('should return WHATSAPP_AI_KNOWLEDGE_DOCUMENT_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedRepo.findById.mockResolvedValue(ok(null))

      expectErr(
        await WhatsAppAiKnowledgeDocumentService.remove('u1', 'ws1', 'doc1'),
        'WHATSAPP_AI_KNOWLEDGE_DOCUMENT_NOT_FOUND',
      )
    })

    it('should delete the db row and the storage object', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedRepo.findById.mockResolvedValue(
        ok(
          createFakeWhatsAppAiKnowledgeDocument({
            id: 'doc1',
            storageKey: 'ws1/doc1.pdf',
          }),
        ),
      )
      mockedRepo.delete.mockResolvedValue(ok(undefined))

      expectOk(
        await WhatsAppAiKnowledgeDocumentService.remove('u1', 'ws1', 'doc1'),
      )
      expect(mockedDeleteObject).toHaveBeenCalledWith({
        bucket: 'whatsapp-ai-knowledge',
        key: 'ws1/doc1.pdf',
      })
    })
  })
})
