import type {
  WhatsAppAiKnowledgeDocument,
  WhatsAppAiKnowledgeDocumentStatus,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WhatsAppAiKnowledgeDocumentRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<WhatsAppAiKnowledgeDocument[]>> {
    try {
      const documents = await prisma.whatsAppAiKnowledgeDocument.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(documents)
    } catch (error) {
      return err(dbError('Failed to list knowledge documents', error))
    }
  },

  /** Só READY, só os campos usados na injeção do prompt do AI reply. */
  async listReadyTextsByWorkspace(
    workspaceId: string,
  ): Promise<Result<{ filename: string; extractedText: string }[]>> {
    try {
      const documents = await prisma.whatsAppAiKnowledgeDocument.findMany({
        where: { workspaceId, status: 'READY' },
        select: { filename: true, extractedText: true },
        orderBy: { createdAt: 'asc' },
      })
      return ok(
        documents
          .filter((d) => d.extractedText)
          .map((d) => ({
            filename: d.filename,
            extractedText: d.extractedText as string,
          })),
      )
    } catch (error) {
      return err(dbError('Failed to list ready knowledge documents', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppAiKnowledgeDocument | null>> {
    try {
      const document = await prisma.whatsAppAiKnowledgeDocument.findFirst({
        where: { id, workspaceId },
      })
      return ok(document)
    } catch (error) {
      return err(dbError('Failed to find knowledge document', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    filename: string
    contentType: string
    sizeBytes: number
    storageKey: string
  }): Promise<Result<WhatsAppAiKnowledgeDocument>> {
    try {
      const document = await prisma.whatsAppAiKnowledgeDocument.create({
        data,
      })
      return ok(document)
    } catch (error) {
      return err(dbError('Failed to create knowledge document', error))
    }
  },

  async updateStatus(
    id: string,
    data: {
      status: WhatsAppAiKnowledgeDocumentStatus
      extractedText?: string
      errorMessage?: string
    },
  ): Promise<Result<WhatsAppAiKnowledgeDocument>> {
    try {
      const document = await prisma.whatsAppAiKnowledgeDocument.update({
        where: { id },
        data,
      })
      return ok(document)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        return err(notFound('WhatsAppAiKnowledgeDocument'))
      }
      return err(dbError('Failed to update knowledge document', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.whatsAppAiKnowledgeDocument.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        return err(notFound('WhatsAppAiKnowledgeDocument'))
      }
      return err(dbError('Failed to delete knowledge document', error))
    }
  },
}
