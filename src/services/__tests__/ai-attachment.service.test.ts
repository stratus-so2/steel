import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeWorkspaceAiSettings } from '@/src/__tests__/factories/ai-settings.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import {
  createFakeAiAttachment,
  createFakeAiConversation,
} from '@/src/__tests__/factories/steel-ai.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { aiConversationNotFound } from '@/src/errors/app-error'
import { AI_ATTACHMENT_MAX_UNSENT } from '@/src/lib/ai/attachments'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/ai-settings.repository')
vi.mock('@/src/repositories/ai-conversation.repository')
vi.mock('@/src/repositories/ai-attachment.repository')
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: vi.fn(),
  putObject: vi.fn(),
  getObject: vi.fn(),
  deleteObject: vi.fn(),
}))
vi.mock('@/src/lib/whatsapp/knowledge-document', () => ({
  extractKnowledgeDocumentText: vi.fn(),
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import {
  deleteObject,
  ensureBucket,
  getObject,
  putObject,
} from '@/src/lib/storage/s3'
import { extractKnowledgeDocumentText } from '@/src/lib/whatsapp/knowledge-document'
import { AiAttachmentRepository } from '@/src/repositories/ai-attachment.repository'
import { AiConversationRepository } from '@/src/repositories/ai-conversation.repository'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { AiAttachmentService } from '../ai-attachment.service'

const memberships = vi.mocked(MembershipRepository)
const settings = vi.mocked(WorkspaceAiSettingsRepository)
const conversations = vi.mocked(AiConversationRepository)
const repo = vi.mocked(AiAttachmentRepository)
const extract = vi.mocked(extractKnowledgeDocumentText)
const audit = vi.mocked(auditMutation)

const doc = {
  buffer: Buffer.from('Prazo: sexta'),
  contentType: 'text/plain',
  fileName: 'notas.txt',
}
const photo = {
  buffer: Buffer.from('png-bytes'),
  contentType: 'image/png',
  fileName: 'foto.png',
}

beforeEach(() => {
  memberships.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
  settings.findByWorkspace.mockResolvedValue(ok(null))
  conversations.findById.mockResolvedValue(
    ok(createFakeAiConversation({ id: 'conv1', workspaceId: 'ws1' })),
  )
  repo.countUnsent.mockResolvedValue(ok(0))
  repo.create.mockImplementation(async (data) =>
    ok(createFakeAiAttachment({ ...data, messageId: null })),
  )
  extract.mockResolvedValue(ok('Prazo: sexta'))
  vi.mocked(ensureBucket).mockResolvedValue(undefined)
  vi.mocked(putObject).mockResolvedValue(undefined)
  vi.mocked(getObject).mockResolvedValue(Buffer.from('bytes'))
  vi.mocked(deleteObject).mockResolvedValue(undefined)
})

describe('AiAttachmentService.upload()', () => {
  it('should store a document with its extracted text and audit it', async () => {
    const dto = expectOk(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
    )
    expect(dto).toEqual(
      expect.objectContaining({
        kind: 'DOCUMENT',
        filename: 'notas.txt',
        messageId: null,
        url: expect.stringMatching(
          /^\/api\/workspaces\/ws1\/ai\/conversations\/conv1\/attachments\//,
        ),
      }),
    )
    expect(putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'steel-ai-attachments',
        key: expect.stringMatching(/^ws1\/conv1\/.+-notas\.txt$/),
        contentType: 'text/plain',
      }),
    )
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedById: 'u1',
        extractedText: 'Prazo: sexta',
        sizeBytes: doc.buffer.byteLength,
      }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ai_attachment', action: 'upload' }),
    )
  })

  it('should store an image without extracting text', async () => {
    expectOk(await AiAttachmentService.upload('u1', 'ws1', 'conv1', photo))
    expect(extract).not.toHaveBeenCalled()
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'IMAGE', extractedText: null }),
    )
  })

  it('should refuse when the AI is off, for strangers and foreign conversations', async () => {
    settings.findByWorkspace.mockResolvedValue(
      ok(createFakeWorkspaceAiSettings({ aiEnabled: false })),
    )
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'AI_DISABLED',
    )

    settings.findByWorkspace.mockResolvedValue(ok(null))
    memberships.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'FORBIDDEN',
    )

    memberships.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership()),
    )
    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'AI_CONVERSATION_NOT_FOUND',
    )
    expect(putObject).not.toHaveBeenCalled()
  })

  it('should refuse unsupported files and unreadable documents', async () => {
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', {
        ...doc,
        contentType: 'application/zip',
        fileName: 'a.zip',
      }),
      'AI_ATTACHMENT_UNSUPPORTED',
    )

    extract.mockResolvedValue(ok('   '))
    const blank = expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'AI_ATTACHMENT_UNSUPPORTED',
    )
    expect(blank.message).toContain('Não foi possível ler o texto')

    extract.mockResolvedValue(err('bad pdf'))
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'AI_ATTACHMENT_UNSUPPORTED',
    )
    expect(putObject).not.toHaveBeenCalled()
  })

  it('should cap the unsent attachments of a conversation', async () => {
    repo.countUnsent.mockResolvedValue(ok(AI_ATTACHMENT_MAX_UNSENT))
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'VALIDATION_ERROR',
    )
    repo.countUnsent.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'DATABASE_ERROR',
    )
  })

  it('should map storage and database failures', async () => {
    vi.mocked(putObject).mockRejectedValueOnce(new Error('minio down'))
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'STORAGE_ERROR',
    )
    vi.mocked(putObject).mockRejectedValueOnce('boom')
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'STORAGE_ERROR',
    )

    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiAttachmentService.upload('u1', 'ws1', 'conv1', doc),
      'DATABASE_ERROR',
    )
  })
})

describe('AiAttachmentService.download()', () => {
  it('should serve the file to the conversation owner', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeAiAttachment({ contentType: 'image/png', filename: 'f.png' }),
      ),
    )
    expect(
      expectOk(await AiAttachmentService.download('u1', 'ws1', 'conv1', 'a1')),
    ).toEqual({
      body: Buffer.from('bytes'),
      contentType: 'image/png',
      fileName: 'f.png',
    })
  })

  it('should answer 404 for missing rows or objects', async () => {
    repo.findById.mockResolvedValue(ok(createFakeAiAttachment()))
    vi.mocked(getObject).mockRejectedValueOnce(new Error('NoSuchKey'))
    expectErr(
      await AiAttachmentService.download('u1', 'ws1', 'conv1', 'a1'),
      'AI_ATTACHMENT_NOT_FOUND',
    )

    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await AiAttachmentService.download('u1', 'ws1', 'conv1', 'a1'),
      'AI_CONVERSATION_NOT_FOUND',
    )
  })

  it('should propagate a row lookup failure', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiAttachmentService.download('u1', 'ws1', 'conv1', 'a1'),
      'DATABASE_ERROR',
    )
  })
})

describe('AiAttachmentService.remove()', () => {
  it('should delete an unsent attachment and its object', async () => {
    repo.findById.mockResolvedValue(ok(createFakeAiAttachment()))
    repo.deleteUnsent.mockResolvedValue(ok(true))
    expectOk(await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'))
    expect(deleteObject).toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ai_attachment', action: 'delete' }),
    )
  })

  it('should still succeed when the object cannot be deleted', async () => {
    repo.findById.mockResolvedValue(ok(createFakeAiAttachment()))
    repo.deleteUnsent.mockResolvedValue(ok(true))
    vi.mocked(deleteObject).mockRejectedValueOnce(new Error('down'))
    expectOk(await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'))
    vi.mocked(deleteObject).mockRejectedValueOnce('down')
    expectOk(await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'))
  })

  it('should refuse sent attachments and lost races', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeAiAttachment({ messageId: 'm1' })),
    )
    expectErr(
      await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'),
      'VALIDATION_ERROR',
    )

    repo.findById.mockResolvedValue(ok(createFakeAiAttachment()))
    repo.deleteUnsent.mockResolvedValue(ok(false))
    expectErr(
      await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'),
      'AI_ATTACHMENT_NOT_FOUND',
    )

    repo.deleteUnsent.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'),
      'DATABASE_ERROR',
    )

    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'),
      'DATABASE_ERROR',
    )

    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await AiAttachmentService.remove('u1', 'ws1', 'conv1', 'a1'),
      'AI_CONVERSATION_NOT_FOUND',
    )
  })
})

describe('AiAttachmentService.loadForSend()', () => {
  it('should return nothing without ids', async () => {
    expect(
      expectOk(await AiAttachmentService.loadForSend('u1', 'c', [])),
    ).toEqual([])
    expect(repo.listUnsent).not.toHaveBeenCalled()
  })

  it('should load images bytes in the asked order', async () => {
    repo.listUnsent.mockResolvedValue(
      ok([
        createFakeAiAttachment({ id: 'd1' }),
        createFakeAiAttachment({
          id: 'i1',
          kind: 'IMAGE',
          contentType: 'image/png',
          extractedText: null,
        }),
      ]),
    )
    const list = expectOk(
      await AiAttachmentService.loadForSend('u1', 'conv1', ['i1', 'd1', 'i1']),
    )
    expect(repo.listUnsent).toHaveBeenCalledWith(['i1', 'd1'], 'conv1', 'u1')
    expect(list.map((a) => a.id)).toEqual(['i1', 'd1'])
    expect(list[0].data).toEqual(Buffer.from('bytes'))
    expect(list[1].data).toBeUndefined()
  })

  it('should fail when any id is unknown, sent or someone else’s', async () => {
    repo.listUnsent.mockResolvedValue(
      ok([createFakeAiAttachment({ id: 'd1' })]),
    )
    expectErr(
      await AiAttachmentService.loadForSend('u1', 'conv1', ['d1', 'x']),
      'AI_ATTACHMENT_NOT_FOUND',
    )
    repo.listUnsent.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiAttachmentService.loadForSend('u1', 'conv1', ['d1']),
      'DATABASE_ERROR',
    )
  })

  it('should fail when an image cannot be read', async () => {
    repo.listUnsent.mockResolvedValue(
      ok([createFakeAiAttachment({ id: 'i1', kind: 'IMAGE' })]),
    )
    vi.mocked(getObject).mockRejectedValueOnce(new Error('down'))
    expectErr(
      await AiAttachmentService.loadForSend('u1', 'conv1', ['i1']),
      'STORAGE_ERROR',
    )
  })
})

describe('AiAttachmentService.historyNotes()', () => {
  it('should group notes by message', async () => {
    repo.listByMessageIds.mockResolvedValue(
      ok([
        createFakeAiAttachment({ messageId: 'm1', filename: 'a.txt' }),
        createFakeAiAttachment({ messageId: 'm1', filename: 'b.txt' }),
        createFakeAiAttachment({
          messageId: 'm2',
          kind: 'IMAGE',
          filename: 'c.png',
        }),
      ]),
    )
    const notes = await AiAttachmentService.historyNotes(['m1', 'm2'])
    expect(notes.get('m1')).toContain('a.txt')
    expect(notes.get('m1')).toContain('b.txt')
    expect(notes.get('m2')).toContain('não reenviada')
  })

  it('should degrade to no notes on failure', async () => {
    repo.listByMessageIds.mockResolvedValue(err(databaseError()))
    expect((await AiAttachmentService.historyNotes(['m1'])).size).toBe(0)
  })
})
