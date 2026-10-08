import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeAiSkill } from '@/src/__tests__/factories/ai-skill-memory.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, forbidden } from '@/src/errors'
import { aiSkillNotFound } from '@/src/errors/app-error'
import { SYSTEM_PROFILE_PERMISSIONS } from '@/src/lib/permissions'
import { err, ok } from '@/src/lib/result'
import {
  CreateAiSkillSchema,
  UpdateAiSkillSchema,
} from '@/src/schemas/ai-skill.schema'

vi.mock('@/src/services/authz', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/services/authz')>()),
  assertMember: vi.fn(),
}))
vi.mock('@/src/repositories/ai-skill.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { AiSkillRepository } from '@/src/repositories/ai-skill.repository'
import { assertMember } from '@/src/services/authz'
import { AiSkillService } from '../ai-skill.service'

const member = vi.mocked(assertMember)
const repo = vi.mocked(AiSkillRepository)
const audit = vi.mocked(auditMutation)

const ADMIN = { role: 'ADMIN' as const, isPrivileged: true, permissions: null }
const MEMBER = {
  role: 'MEMBER' as const,
  isPrivileged: false,
  permissions: SYSTEM_PROFILE_PERMISSIONS.MEMBER,
}
const VIEWER = {
  role: 'VIEWER' as const,
  isPrivileged: false,
  permissions: SYSTEM_PROFILE_PERMISSIONS.VIEWER,
}

const input = (patch: Record<string, unknown> = {}) =>
  CreateAiSkillSchema.parse({
    slug: 'resumo',
    name: 'Resumo',
    description: 'Resumo do cliente',
    instructions: 'Resuma.',
    ...patch,
  })
const update = (patch: Record<string, unknown>) =>
  UpdateAiSkillSchema.parse(patch)

beforeEach(() => {
  member.mockResolvedValue(ok(MEMBER))
  repo.listVisible.mockResolvedValue(ok([]))
  repo.findBySlug.mockResolvedValue(ok(null))
  repo.create.mockImplementation(async (data) =>
    ok(createFakeAiSkill({ id: 'new', ...data })),
  )
  repo.update.mockImplementation(async (id, data) =>
    ok(createFakeAiSkill({ id, ownerId: 'u1', ...data })),
  )
  repo.softDelete.mockImplementation(async (id) =>
    ok(createFakeAiSkill({ id })),
  )
})

describe('AiSkillService.list()', () => {
  it('merges built-ins with the visible rows', async () => {
    repo.listVisible.mockResolvedValue(
      ok([createFakeAiSkill({ id: 'p1', ownerId: 'u1' })]),
    )
    const list = expectOk(await AiSkillService.list('u1', 'ws1'))
    expect(list.canManageWorkspace).toBe(false)
    expect(list.skills[0].kind).toBe('BUILT_IN')
    expect(list.skills.at(-1)).toMatchObject({ id: 'p1', canEdit: true })
    expect(repo.listVisible).toHaveBeenCalledWith('ws1', 'u1')
  })

  it('reports admins as workspace managers', async () => {
    member.mockResolvedValue(ok(ADMIN))
    const list = expectOk(await AiSkillService.list('u1', 'ws1'))
    expect(list.canManageWorkspace).toBe(true)
    expect(list.skills[0].canToggle).toBe(true)
  })

  it('denies non-members and propagates db errors', async () => {
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(await AiSkillService.list('x', 'ws1'), 'FORBIDDEN')
    repo.listVisible.mockResolvedValue(err(databaseError('down')))
    expectErr(await AiSkillService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('AiSkillService.create()', () => {
  it('lets any member, even a viewer, create a personal skill', async () => {
    member.mockResolvedValue(ok(VIEWER))
    const dto = expectOk(
      await AiSkillService.create(
        'u1',
        'ws1',
        input({ toolNames: ['ws_overview'], mode: 'EXPLORE' }),
      ),
    )
    expect(dto).toMatchObject({
      kind: 'PERSONAL',
      slug: 'resumo',
      canEdit: true,
    })
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        scope: 'PERSONAL',
        ownerId: 'u1',
        createdById: 'u1',
        toolNames: ['ws_overview'],
      }),
    )
    expect(repo.findBySlug).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      scope: 'PERSONAL',
      ownerId: 'u1',
      slug: 'resumo',
      builtIn: false,
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ai_skill', action: 'create' }),
    )
  })

  it('restricts workspace skills to admins', async () => {
    expectErr(
      await AiSkillService.create('u1', 'ws1', input({ scope: 'WORKSPACE' })),
      'FORBIDDEN',
    )
    member.mockResolvedValue(ok(ADMIN))
    const dto = expectOk(
      await AiSkillService.create('u1', 'ws1', input({ scope: 'WORKSPACE' })),
    )
    expect(dto).toMatchObject({ kind: 'WORKSPACE', canEdit: true })
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'WORKSPACE', ownerId: null }),
    )
  })

  it('rejects unknown tools', async () => {
    const error = expectErr(
      await AiSkillService.create(
        'u1',
        'ws1',
        input({ toolNames: ['ws_overview', 'nope_tool'] }),
      ),
      'VALIDATION_ERROR',
    )
    expect(error.message).toContain('nope_tool')
  })

  it('rejects a built-in command and a taken one', async () => {
    expectErr(
      await AiSkillService.create('u1', 'ws1', input({ slug: 'my-work' })),
      'AI_SKILL_SLUG_TAKEN',
    )
    repo.findBySlug.mockResolvedValue(ok(createFakeAiSkill({ id: 'other' })))
    expectErr(
      await AiSkillService.create('u1', 'ws1', input()),
      'AI_SKILL_SLUG_TAKEN',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('propagates membership and database errors', async () => {
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(await AiSkillService.create('x', 'ws1', input()), 'FORBIDDEN')
    repo.findBySlug.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(
      await AiSkillService.create('u1', 'ws1', input()),
      'DATABASE_ERROR',
    )
    repo.create.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(
      await AiSkillService.create('u1', 'ws1', input()),
      'DATABASE_ERROR',
    )
  })
})

describe('AiSkillService.update()', () => {
  const personal = createFakeAiSkill({
    id: 'p1',
    scope: 'PERSONAL',
    ownerId: 'u1',
    slug: 'resumo',
  })
  const shared = createFakeAiSkill({
    id: 'w1',
    scope: 'WORKSPACE',
    ownerId: null,
    slug: 'time',
  })

  it('edits the owner’s personal skill and checks a new command', async () => {
    repo.findById.mockResolvedValue(ok(personal))
    const dto = expectOk(
      await AiSkillService.update(
        'u1',
        'ws1',
        'p1',
        update({ slug: 'novo', name: 'Novo' }),
      ),
    )
    expect(dto.slug).toBe('novo')
    expect(repo.findBySlug).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'novo',
        scope: 'PERSONAL',
        ownerId: 'u1',
      }),
    )
    expect(repo.update).toHaveBeenCalledWith('p1', {
      slug: 'novo',
      name: 'Novo',
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', targetId: 'p1' }),
    )
  })

  it('skips the slug check when the command is unchanged', async () => {
    repo.findById.mockResolvedValue(ok(personal))
    expectOk(
      await AiSkillService.update(
        'u1',
        'ws1',
        'p1',
        update({ slug: 'resumo' }),
      ),
    )
    expect(repo.findBySlug).not.toHaveBeenCalled()
  })

  it('allows keeping the same command on the same row', async () => {
    repo.findById.mockResolvedValue(ok(personal))
    repo.findBySlug.mockResolvedValue(ok(personal))
    expectOk(
      await AiSkillService.update(
        'u1',
        'ws1',
        'p1',
        update({ slug: 'resumo-2' }),
      ),
    )
    repo.findBySlug.mockResolvedValue(ok(createFakeAiSkill({ id: 'other' })))
    expectErr(
      await AiSkillService.update(
        'u1',
        'ws1',
        'p1',
        update({ slug: 'resumo-2' }),
      ),
      'AI_SKILL_SLUG_TAKEN',
    )
  })

  it('hides someone else’s personal skill', async () => {
    repo.findById.mockResolvedValue(ok({ ...personal, ownerId: 'u2' }))
    expectErr(
      await AiSkillService.update('u1', 'ws1', 'p1', update({ name: 'x' })),
      'AI_SKILL_NOT_FOUND',
    )
  })

  it('restricts workspace skills to admins', async () => {
    repo.findById.mockResolvedValue(ok(shared))
    expectErr(
      await AiSkillService.update('u1', 'ws1', 'w1', update({ name: 'x' })),
      'FORBIDDEN',
    )
    member.mockResolvedValue(ok(ADMIN))
    expectOk(
      await AiSkillService.update(
        'u1',
        'ws1',
        'w1',
        update({ enabled: false }),
      ),
    )
  })

  it('never edits a built-in override row by id', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeAiSkill({ scope: 'WORKSPACE', builtIn: true })),
    )
    member.mockResolvedValue(ok(ADMIN))
    expectErr(
      await AiSkillService.update('u1', 'ws1', 'o1', update({ name: 'x' })),
      'AI_SKILL_NOT_FOUND',
    )
  })

  it('validates tools and propagates errors', async () => {
    repo.findById.mockResolvedValue(ok(personal))
    expectErr(
      await AiSkillService.update(
        'u1',
        'ws1',
        'p1',
        update({ toolNames: ['nope_tool'] }),
      ),
      'VALIDATION_ERROR',
    )
    repo.update.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(
      await AiSkillService.update('u1', 'ws1', 'p1', update({ name: 'x' })),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValueOnce(err(aiSkillNotFound()))
    expectErr(
      await AiSkillService.update('u1', 'ws1', 'zz', update({ name: 'x' })),
      'AI_SKILL_NOT_FOUND',
    )
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await AiSkillService.update('x', 'ws1', 'p1', update({ name: 'x' })),
      'FORBIDDEN',
    )
  })

  describe('built-in toggle', () => {
    it('is admin-only and only takes enabled', async () => {
      expectErr(
        await AiSkillService.update(
          'u1',
          'ws1',
          'builtin:sla',
          update({ enabled: false }),
        ),
        'FORBIDDEN',
      )
      member.mockResolvedValue(ok(ADMIN))
      expectErr(
        await AiSkillService.update(
          'u1',
          'ws1',
          'builtin:sla',
          update({ name: 'x' }),
        ),
        'VALIDATION_ERROR',
      )
      expectErr(
        await AiSkillService.update(
          'u1',
          'ws1',
          'builtin:sla',
          update({ enabled: false, name: 'x' }),
        ),
        'VALIDATION_ERROR',
      )
    })

    it('creates the override row on the first toggle', async () => {
      member.mockResolvedValue(ok(ADMIN))
      const dto = expectOk(
        await AiSkillService.update(
          'u1',
          'ws1',
          'builtin:sla',
          update({ enabled: false }),
        ),
      )
      expect(dto).toMatchObject({
        id: 'builtin:sla',
        kind: 'BUILT_IN',
        enabled: false,
      })
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'WORKSPACE',
          slug: 'sla',
          builtIn: true,
          enabled: false,
        }),
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'ai_skill',
          meta: expect.objectContaining({ builtIn: true, enabled: false }),
        }),
      )
    })

    it('updates the existing override row', async () => {
      member.mockResolvedValue(ok(ADMIN))
      repo.findBySlug.mockResolvedValue(
        ok(createFakeAiSkill({ id: 'o1', builtIn: true, enabled: false })),
      )
      const dto = expectOk(
        await AiSkillService.update(
          'u1',
          'ws1',
          'builtin:sla',
          update({ enabled: true }),
        ),
      )
      expect(dto.enabled).toBe(true)
      expect(repo.update).toHaveBeenCalledWith('o1', { enabled: true })
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('propagates database errors', async () => {
      member.mockResolvedValue(ok(ADMIN))
      repo.findBySlug.mockResolvedValueOnce(err(databaseError('down')))
      expectErr(
        await AiSkillService.update(
          'u1',
          'ws1',
          'builtin:sla',
          update({ enabled: false }),
        ),
        'DATABASE_ERROR',
      )
      repo.create.mockResolvedValueOnce(err(databaseError('down')))
      expectErr(
        await AiSkillService.update(
          'u1',
          'ws1',
          'builtin:sla',
          update({ enabled: false }),
        ),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('AiSkillService.delete()', () => {
  it('soft-deletes the owner’s skill', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeAiSkill({ id: 'p1', ownerId: 'u1' })),
    )
    expect(expectOk(await AiSkillService.delete('u1', 'ws1', 'p1'))).toEqual({
      id: 'p1',
    })
    expect(repo.softDelete).toHaveBeenCalledWith('p1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', targetId: 'p1' }),
    )
  })

  it('never deletes a built-in', async () => {
    member.mockResolvedValue(ok(ADMIN))
    const error = expectErr(
      await AiSkillService.delete('u1', 'ws1', 'builtin:my-work'),
      'FORBIDDEN',
    )
    expect(error.message).toContain('desative')
  })

  it('checks ownership and propagates errors', async () => {
    member.mockResolvedValueOnce(err(forbidden()))
    expectErr(await AiSkillService.delete('x', 'ws1', 'p1'), 'FORBIDDEN')
    repo.findById.mockResolvedValueOnce(err(aiSkillNotFound()))
    expectErr(
      await AiSkillService.delete('u1', 'ws1', 'zz'),
      'AI_SKILL_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(
      ok(createFakeAiSkill({ scope: 'WORKSPACE', ownerId: null })),
    )
    expectErr(await AiSkillService.delete('u1', 'ws1', 'w1'), 'FORBIDDEN')
    member.mockResolvedValue(ok(ADMIN))
    repo.softDelete.mockResolvedValueOnce(err(databaseError('down')))
    expectErr(await AiSkillService.delete('u1', 'ws1', 'w1'), 'DATABASE_ERROR')
  })
})
