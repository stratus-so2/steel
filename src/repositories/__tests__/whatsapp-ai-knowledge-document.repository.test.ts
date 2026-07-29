import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWhatsAppAiKnowledgeDocument } from '@/src/__tests__/factories/whatsapp-ai-knowledge-document.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppAiKnowledgeDocumentRepository } from '../whatsapp-ai-knowledge-document.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WhatsAppAiKnowledgeDocumentRepository', () => {
  describe('listByWorkspace()', () => {
    it('should list only documents of the given workspace, newest first', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const a = await seedWhatsAppAiKnowledgeDocument(workspaceA.id, user.id, {
        filename: 'a.pdf',
      })
      await new Promise((resolve) => setTimeout(resolve, 5))
      const b = await seedWhatsAppAiKnowledgeDocument(workspaceA.id, user.id, {
        filename: 'b.pdf',
      })
      await seedWhatsAppAiKnowledgeDocument(workspaceB.id, user.id)

      const result =
        await WhatsAppAiKnowledgeDocumentRepository.listByWorkspace(
          workspaceA.id,
        )

      const list = expectOk(result)
      expect(list.map((d) => d.id)).toEqual([b.id, a.id])
    })
  })

  describe('listReadyTextsByWorkspace()', () => {
    it('should return only READY documents with text', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedWhatsAppAiKnowledgeDocument(workspace.id, user.id, {
        filename: 'pronto.pdf',
        status: 'READY',
        extractedText: 'conteúdo A',
      })
      await seedWhatsAppAiKnowledgeDocument(workspace.id, user.id, {
        filename: 'processando.pdf',
        status: 'PROCESSING',
        extractedText: null,
      })
      await seedWhatsAppAiKnowledgeDocument(workspace.id, user.id, {
        filename: 'falhou.pdf',
        status: 'FAILED',
        extractedText: null,
      })

      const result =
        await WhatsAppAiKnowledgeDocumentRepository.listReadyTextsByWorkspace(
          workspace.id,
        )

      const list = expectOk(result)
      expect(list).toEqual([
        { filename: 'pronto.pdf', extractedText: 'conteúdo A' },
      ])
    })
  })

  describe('create() + findById()', () => {
    it('should persist a document as PROCESSING by default', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const created = expectOk(
        await WhatsAppAiKnowledgeDocumentRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          filename: 'novo.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
          storageKey: 'key-1.pdf',
        }),
      )

      expect(created.status).toBe('PROCESSING')

      const found = expectOk(
        await WhatsAppAiKnowledgeDocumentRepository.findById(
          created.id,
          workspace.id,
        ),
      )
      expect(found?.filename).toBe('novo.pdf')
    })

    it('should not find a document from another workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const doc = await seedWhatsAppAiKnowledgeDocument(workspaceA.id, user.id)

      const found = expectOk(
        await WhatsAppAiKnowledgeDocumentRepository.findById(
          doc.id,
          workspaceB.id,
        ),
      )
      expect(found).toBeNull()
    })
  })

  describe('updateStatus()', () => {
    it('should update status and extractedText', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const doc = await seedWhatsAppAiKnowledgeDocument(workspace.id, user.id, {
        status: 'PROCESSING',
        extractedText: null,
      })

      const updated = expectOk(
        await WhatsAppAiKnowledgeDocumentRepository.updateStatus(doc.id, {
          status: 'READY',
          extractedText: 'texto extraído',
        }),
      )

      expect(updated.status).toBe('READY')
      expect(updated.extractedText).toBe('texto extraído')
    })

    it('should return RESOURCE_NOT_FOUND for a missing document', async () => {
      const result = await WhatsAppAiKnowledgeDocumentRepository.updateStatus(
        'nonexistent',
        { status: 'FAILED', errorMessage: 'boom' },
      )
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('delete()', () => {
    it('should remove the document', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const doc = await seedWhatsAppAiKnowledgeDocument(workspace.id, user.id)

      expectOk(await WhatsAppAiKnowledgeDocumentRepository.delete(doc.id))

      const found = await prisma.whatsAppAiKnowledgeDocument.findUnique({
        where: { id: doc.id },
      })
      expect(found).toBeNull()
    })

    it('should return RESOURCE_NOT_FOUND for a missing document', async () => {
      const result =
        await WhatsAppAiKnowledgeDocumentRepository.delete('nonexistent')
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })
})
