import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeWorkspaceAiSettings } from '@/src/__tests__/factories/ai-settings.factory'
import { createFakeAiMemory } from '@/src/__tests__/factories/ai-skill-memory.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, forbidden } from '@/src/errors'
import { aiMemoryNotFound } from '@/src/errors/app-error'
import type { AiToolContext } from '@/src/lib/ai/tools/types'
import { SYSTEM_PROFILE_PERMISSIONS } from '@/src/lib/permissions'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/authz', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/services/authz')>()),
  assertMember: vi.fn(),
}))
vi.mock('@/src/repositories/ai-memory.repository')
vi.mock('@/src/repositories/ai-settings.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { AiMemoryRepository } from '@/src/repositories/ai-memory.repository'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import { assertMember } from '@/src/services/authz'
import { AiMemoryService } from '../ai-memory.service'

const member = vi.mocked(assertMember)
const repo = vi.mocked(AiMemoryRepository)
const settings = vi.mocked(WorkspaceAiSettingsRepository)
const audit = vi.mocked(auditMutation)

const ADMIN = { role: 'ADMIN' as const, isPrivileged: true, permissions: null }
const MEMBER = {
  role: 'MEMBER' as const,
  isPrivileged: false,
  permissions: SYSTEM_PROFILE_PERMISSIONS.MEMBER,
}
const ctx: AiToolContext = {
  workspaceId: 'ws1',
  actorId: 'u1',
  source: 'assistant',
  conversationId: 'conv1',
}

const workspaceFact = createFakeAiMemory({
  id: 'w1',
  workspaceId: 'ws1',
  scope: 'WORKSPACE',
  userId: null,
  content: 'O suporte atende das 8h às 18h',
})
const personalFact = createFakeAiMemory({
  id: 'p1',
  workspaceId: 'ws1',
  scope: 'PERSONAL',
  userId: 'u1',
  createdById: 'u1',
  sourceConversationId: 'conv0',
  content: 'Prefere respostas em tópicos',
})

function memoryOn(on: boolean | null) {
  settings.findByWorkspace.mockResolvedValue(
    ok(
      on === null ? null : createFakeWorkspaceAiSettings({ memoryEnabled: on }),
    ),
  )
}

beforeEach(() => {
  member.mockResolvedValue(ok(MEMBER))
  memoryOn(true)
  repo.listVisible.mockResolvedValue(ok([workspaceFact, personalFact]))
  repo.findById.mockResolvedValue(ok(personalFact))
  repo.create.mockImplementation(async (data) =>
    ok(createFakeAiMemory({ id: 'new', ...data })),
  )
  repo.updateContent.mockImplementation(async (id, content) =>
    ok({ ...personalFact, id, content }),
  )
  repo.softDelete.mockImplementation(async (id) => ok({ ...personalFact, id }))
})

describe('AiMemoryService.list()', () => {
  it('splits the layers and reports the switch', async () => {
    const list = expectOk(
      await AiMemoryService.list('u1', 'ws1', { q: 'suporte' }),
    )
    expect(list).toMatchObject({
      memoryEnabled: true,
      canManageWorkspace: false,
    })
    expect(list.workspace.map((m) => m.id)).toEqual(['w1'])
    expect(list.personal.map((m) => m.id)).toEqual(['p1'])
    expect(list.workspace[0].canEdit).toBe(false)
    expect(list.personal[0].sourceConversationId).toBe('conv0')
    expect(repo.listVisible).toHaveBeenCalledWith('ws1', 'u1', { q: 'suporte' })
  })

  it('still lists with memory off (default on without settings)', async () => {
    memoryOn(false)
    expect(
      expectOk(await AiMemoryService.list('u1', 'ws1')).memoryEnabled,
    ).toBe(false)
    memoryOn(null)
    member.mockResolvedValue(ok(ADMIN))
    const list = expectOk(await AiMemoryService.list('u1', 'ws1'))
    expect(list.memoryEnabled).toBe(true)
    expect(list.workspace[0].canEdit).toBe(true)
  })

  it('propagates errors', async () => {
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(await AiMemoryService.list('x', 'ws1'), 'FORBIDDEN')
    settings.findByWorkspace.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.list('u1', 'ws1'), 'DATABASE_ERROR')
    repo.listVisible.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('AiMemoryService.create()', () => {
  it('adds a personal fact by hand', async () => {
    const dto = expectOk(
      await AiMemoryService.create('u1', 'ws1', {
        scope: 'PERSONAL',
        content: 'Trabalho no turno da noite',
      }),
    )
    expect(dto).toMatchObject({ id: 'new', source: 'MANUAL', canEdit: true })
    expect(repo.create).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      scope: 'PERSONAL',
      userId: 'u1',
      content: 'Trabalho no turno da noite',
      source: 'MANUAL',
      sourceConversationId: null,
      createdById: 'u1',
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'ai_memory',
        action: 'create',
        meta: { workspaceId: 'ws1', scope: 'PERSONAL', source: 'MANUAL' },
      }),
    )
  })

  it('restricts workspace facts to admins', async () => {
    const body = { scope: 'WORKSPACE' as const, content: 'Fato do time novo' }
    expectErr(await AiMemoryService.create('u1', 'ws1', body), 'FORBIDDEN')
    member.mockResolvedValue(ok(ADMIN))
    expectOk(await AiMemoryService.create('u1', 'ws1', body))
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'WORKSPACE', userId: null }),
    )
  })

  it('refuses when memory is off, guarded content and duplicates', async () => {
    memoryOn(false)
    expectErr(
      await AiMemoryService.create('u1', 'ws1', {
        scope: 'PERSONAL',
        content: 'x',
      }),
      'AI_MEMORY_DISABLED',
    )
    memoryOn(true)
    expectErr(
      await AiMemoryService.create('u1', 'ws1', {
        scope: 'PERSONAL',
        content: 'Minha senha é 123',
      }),
      'VALIDATION_ERROR',
    )
    expectErr(
      await AiMemoryService.create('u1', 'ws1', {
        scope: 'PERSONAL',
        content: 'o suporte atende das 8h as 18h!',
      }),
      'CONFLICT',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('only compares a workspace fact with workspace facts', async () => {
    member.mockResolvedValue(ok(ADMIN))
    expectOk(
      await AiMemoryService.create('u1', 'ws1', {
        scope: 'WORKSPACE',
        content: 'Prefere respostas em tópicos',
      }),
    )
  })

  it('propagates errors', async () => {
    const body = { scope: 'PERSONAL' as const, content: 'Fato novo' }
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(await AiMemoryService.create('x', 'ws1', body), 'FORBIDDEN')
    settings.findByWorkspace.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.create('u1', 'ws1', body), 'DATABASE_ERROR')
    repo.listVisible.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.create('u1', 'ws1', body), 'DATABASE_ERROR')
    repo.create.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.create('u1', 'ws1', body), 'DATABASE_ERROR')
  })
})

describe('AiMemoryService.update()', () => {
  it('edits the owner’s fact', async () => {
    const dto = expectOk(
      await AiMemoryService.update('u1', 'ws1', 'p1', { content: 'Novo' }),
    )
    expect(dto.content).toBe('Novo')
    expect(repo.updateContent).toHaveBeenCalledWith('p1', 'Novo')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', targetId: 'p1' }),
    )
  })

  it('applies authz and the guard', async () => {
    repo.findById.mockResolvedValue(ok({ ...personalFact, userId: 'u2' }))
    expectErr(
      await AiMemoryService.update('u1', 'ws1', 'p1', { content: 'x' }),
      'AI_MEMORY_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(ok(workspaceFact))
    expectErr(
      await AiMemoryService.update('u1', 'ws1', 'w1', { content: 'x' }),
      'FORBIDDEN',
    )
    member.mockResolvedValue(ok(ADMIN))
    expectErr(
      await AiMemoryService.update('u1', 'ws1', 'w1', {
        content: 'CPF 123.456.789-09',
      }),
      'VALIDATION_ERROR',
    )
    expectOk(await AiMemoryService.update('u1', 'ws1', 'w1', { content: 'ok' }))
  })

  it('propagates errors', async () => {
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await AiMemoryService.update('x', 'ws1', 'p1', { content: 'x' }),
      'FORBIDDEN',
    )
    repo.findById.mockResolvedValueOnce(err(aiMemoryNotFound()))
    expectErr(
      await AiMemoryService.update('u1', 'ws1', 'zz', { content: 'x' }),
      'AI_MEMORY_NOT_FOUND',
    )
    repo.updateContent.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(
      await AiMemoryService.update('u1', 'ws1', 'p1', { content: 'x' }),
      'DATABASE_ERROR',
    )
  })
})

describe('AiMemoryService.delete()', () => {
  it('soft-deletes and audits (works with memory off)', async () => {
    memoryOn(false)
    expect(expectOk(await AiMemoryService.delete('u1', 'ws1', 'p1'))).toEqual({
      id: 'p1',
    })
    expect(repo.softDelete).toHaveBeenCalledWith('p1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        meta: { workspaceId: 'ws1', scope: 'PERSONAL', via: 'tab' },
      }),
    )
  })

  it('propagates errors', async () => {
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(await AiMemoryService.delete('x', 'ws1', 'p1'), 'FORBIDDEN')
    repo.findById.mockResolvedValueOnce(err(aiMemoryNotFound()))
    expectErr(
      await AiMemoryService.delete('u1', 'ws1', 'zz'),
      'AI_MEMORY_NOT_FOUND',
    )
    repo.findById.mockResolvedValueOnce(ok(workspaceFact))
    expectErr(await AiMemoryService.delete('u1', 'ws1', 'w1'), 'FORBIDDEN')
    repo.softDelete.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.delete('u1', 'ws1', 'p1'), 'DATABASE_ERROR')
  })
})

describe('AiMemoryService.saveFromModel()', () => {
  it('saves an AUTO fact linked to the conversation', async () => {
    const saved = expectOk(
      await AiMemoryService.saveFromModel(ctx, {
        content: 'Usa o relatório semanal às segundas',
        scope: 'PERSONAL',
      }),
    )
    expect(saved).toMatchObject({ action: 'saved', downgraded: false })
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'PERSONAL',
        userId: 'u1',
        source: 'AUTO',
        sourceConversationId: 'conv1',
      }),
    )
  })

  it('downgrades a workspace fact from a non-admin to personal', async () => {
    const saved = expectOk(
      await AiMemoryService.saveFromModel(
        { ...ctx, conversationId: undefined },
        { content: 'O time usa Kanban', scope: 'WORKSPACE' },
      ),
    )
    expect(saved.downgraded).toBe(true)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'PERSONAL',
        sourceConversationId: null,
      }),
    )
  })

  it('keeps a workspace fact for admins', async () => {
    member.mockResolvedValue(ok(ADMIN))
    const saved = expectOk(
      await AiMemoryService.saveFromModel(ctx, {
        content: 'O time usa Kanban',
        scope: 'WORKSPACE',
      }),
    )
    expect(saved.downgraded).toBe(false)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'WORKSPACE', userId: null }),
    )
  })

  it('returns the existing fact instead of a near-duplicate', async () => {
    const saved = expectOk(
      await AiMemoryService.saveFromModel(ctx, {
        content: 'prefere respostas em tópicos.',
        scope: 'PERSONAL',
      }),
    )
    expect(saved).toMatchObject({ action: 'duplicate' })
    expect(saved.memory.id).toBe('p1')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('refuses with memory off and guarded content', async () => {
    memoryOn(false)
    expectErr(
      await AiMemoryService.saveFromModel(ctx, {
        content: 'x',
        scope: 'PERSONAL',
      }),
      'AI_MEMORY_DISABLED',
    )
    memoryOn(true)
    expectErr(
      await AiMemoryService.saveFromModel(ctx, {
        content: 'A religião do Bruno é espírita',
        scope: 'PERSONAL',
      }),
      'VALIDATION_ERROR',
    )
  })

  it('propagates errors', async () => {
    const args = { content: 'Fato novo', scope: 'PERSONAL' as const }
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(await AiMemoryService.saveFromModel(ctx, args), 'FORBIDDEN')
    settings.findByWorkspace.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.saveFromModel(ctx, args), 'DATABASE_ERROR')
    repo.listVisible.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.saveFromModel(ctx, args), 'DATABASE_ERROR')
    repo.create.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.saveFromModel(ctx, args), 'DATABASE_ERROR')
  })
})

describe('AiMemoryService.forgetFromModel()', () => {
  it('deletes with the same rules as the tab', async () => {
    expectOk(await AiMemoryService.forgetFromModel(ctx, 'p1'))
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        meta: expect.objectContaining({ via: 'model' }),
      }),
    )
    repo.findById.mockResolvedValueOnce(ok(workspaceFact))
    expectErr(await AiMemoryService.forgetFromModel(ctx, 'w1'), 'FORBIDDEN')
  })
})

describe('AiMemoryService.forPrompt() / markUsed()', () => {
  it('returns the newest facts, or null when memory is off', async () => {
    expect(expectOk(await AiMemoryService.forPrompt(ctx))).toHaveLength(2)
    expect(repo.listVisible).toHaveBeenCalledWith('ws1', 'u1', { take: 100 })
    memoryOn(false)
    expect(expectOk(await AiMemoryService.forPrompt(ctx))).toBeNull()
    settings.findByWorkspace.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiMemoryService.forPrompt(ctx), 'DATABASE_ERROR')
  })

  it('stamps lastUsedAt and swallows failures', async () => {
    repo.touchUsed.mockResolvedValueOnce(ok(2))
    await AiMemoryService.markUsed(['w1', 'p1'])
    expect(repo.touchUsed).toHaveBeenCalledWith(['w1', 'p1'], expect.any(Date))
    repo.touchUsed.mockResolvedValueOnce(err(databaseError('down')))
    await expect(AiMemoryService.markUsed(['w1'])).resolves.toBeUndefined()
  })
})
