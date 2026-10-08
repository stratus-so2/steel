import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  seedAiMemory,
  seedAiSkill,
} from '@/src/__tests__/factories/ai-skill-memory.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { AiMemoryRepository } from '../ai-memory.repository'
import { AiSkillRepository } from '../ai-skill.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AiSkillRepository', () => {
  it('lists workspace skills and only the actor’s personal ones', async () => {
    const [workspace, other, ana, bob] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    await Promise.all([
      seedAiSkill(workspace.id, { slug: 'b-time', name: 'B time' }),
      seedAiSkill(workspace.id, {
        scope: 'PERSONAL',
        ownerId: ana.id,
        slug: 'a-ana',
        name: 'A Ana',
      }),
      seedAiSkill(workspace.id, {
        scope: 'PERSONAL',
        ownerId: bob.id,
        slug: 'bob',
        name: 'Bob',
      }),
      seedAiSkill(workspace.id, {
        slug: 'gone',
        name: 'Gone',
        deletedAt: new Date(),
      }),
      seedAiSkill(other.id, { slug: 'other', name: 'Other' }),
    ])

    const rows = expectOk(
      await AiSkillRepository.listVisible(workspace.id, ana.id),
    )
    expect(rows.map((r) => r.slug)).toEqual(['a-ana', 'b-time'])
  })

  it('finds by id within the workspace, ignoring deleted rows', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const skill = await seedAiSkill(workspace.id)
    const deleted = await seedAiSkill(workspace.id, { deletedAt: new Date() })

    expect(
      expectOk(await AiSkillRepository.findById(skill.id, workspace.id)).id,
    ).toBe(skill.id)
    expectErr(
      await AiSkillRepository.findById(skill.id, other.id),
      'AI_SKILL_NOT_FOUND',
    )
    expectErr(
      await AiSkillRepository.findById(deleted.id, workspace.id),
      'AI_SKILL_NOT_FOUND',
    )
  })

  it('finds by slug per scope, owner and built-in flag', async () => {
    const [workspace, ana, bob] = await Promise.all([
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    const shared = await seedAiSkill(workspace.id, { slug: 'resumo' })
    const mine = await seedAiSkill(workspace.id, {
      scope: 'PERSONAL',
      ownerId: ana.id,
      slug: 'resumo',
    })
    const override = await seedAiSkill(workspace.id, {
      slug: 'sla',
      builtIn: true,
      enabled: false,
    })
    const find = (input: {
      scope: 'WORKSPACE' | 'PERSONAL'
      ownerId: string | null
      slug: string
      builtIn?: boolean
    }) =>
      AiSkillRepository.findBySlug({
        workspaceId: workspace.id,
        builtIn: false,
        ...input,
      })

    expect(
      expectOk(
        await find({ scope: 'WORKSPACE', ownerId: null, slug: 'resumo' }),
      )?.id,
    ).toBe(shared.id)
    expect(
      expectOk(
        await find({ scope: 'PERSONAL', ownerId: ana.id, slug: 'resumo' }),
      )?.id,
    ).toBe(mine.id)
    expect(
      expectOk(
        await find({ scope: 'PERSONAL', ownerId: bob.id, slug: 'resumo' }),
      ),
    ).toBeNull()
    expect(
      expectOk(await find({ scope: 'WORKSPACE', ownerId: null, slug: 'sla' })),
    ).toBeNull()
    expect(
      expectOk(
        await find({
          scope: 'WORKSPACE',
          ownerId: null,
          slug: 'sla',
          builtIn: true,
        }),
      )?.id,
    ).toBe(override.id)
  })

  it('creates, updates and soft-deletes', async () => {
    const [workspace, ana] = await Promise.all([seedWorkspace(), seedUser()])
    const created = expectOk(
      await AiSkillRepository.create({
        workspaceId: workspace.id,
        scope: 'PERSONAL',
        ownerId: ana.id,
        slug: 'minha',
        name: 'Minha',
        description: 'Desc',
        instructions: 'Faça',
        mode: 'AGENT',
        toolNames: ['ws_overview'],
        enabled: true,
        createdById: ana.id,
      }),
    )
    expect(created).toMatchObject({ builtIn: false, mode: 'AGENT' })

    const updated = expectOk(
      await AiSkillRepository.update(created.id, {
        enabled: false,
        mode: null,
      }),
    )
    expect(updated).toMatchObject({ enabled: false, mode: null })

    expectOk(await AiSkillRepository.softDelete(created.id))
    expectErr(
      await AiSkillRepository.findById(created.id, workspace.id),
      'AI_SKILL_NOT_FOUND',
    )
  })

  it('returns DATABASE_ERROR when Prisma fails', async () => {
    vi.spyOn(prisma.aiSkill, 'findMany').mockRejectedValueOnce(new Error('x'))
    vi.spyOn(prisma.aiSkill, 'findFirst')
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
    vi.spyOn(prisma.aiSkill, 'create').mockRejectedValueOnce(new Error('x'))
    vi.spyOn(prisma.aiSkill, 'update')
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))

    expectErr(await AiSkillRepository.listVisible('w', 'u'), 'DATABASE_ERROR')
    expectErr(await AiSkillRepository.findById('s', 'w'), 'DATABASE_ERROR')
    expectErr(
      await AiSkillRepository.findBySlug({
        workspaceId: 'w',
        scope: 'WORKSPACE',
        ownerId: null,
        slug: 's',
        builtIn: false,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiSkillRepository.create({
        workspaceId: 'w',
        scope: 'WORKSPACE',
        ownerId: null,
        slug: 's',
        name: 'n',
        description: 'd',
        instructions: 'i',
        mode: null,
        toolNames: [],
        enabled: true,
        createdById: 'u',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiSkillRepository.update('s', { enabled: true }),
      'DATABASE_ERROR',
    )
    expectErr(await AiSkillRepository.softDelete('s'), 'DATABASE_ERROR')
  })
})

describe('AiMemoryRepository', () => {
  it('lists workspace and own personal facts, newest first, with search', async () => {
    const [workspace, other, ana, bob] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    await seedAiMemory(workspace.id, {
      content: 'Suporte das 8h às 18h',
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    })
    await seedAiMemory(workspace.id, {
      scope: 'PERSONAL',
      userId: ana.id,
      content: 'Ana prefere TÓPICOS',
      updatedAt: new Date('2026-10-05T00:00:00Z'),
    })
    await seedAiMemory(workspace.id, {
      scope: 'PERSONAL',
      userId: bob.id,
      content: 'Bob prefere tabelas',
    })
    await seedAiMemory(workspace.id, {
      content: 'Apagado',
      deletedAt: new Date(),
    })
    await seedAiMemory(other.id, { content: 'Outro workspace' })

    const all = expectOk(
      await AiMemoryRepository.listVisible(workspace.id, ana.id),
    )
    expect(all.map((m) => m.content)).toEqual([
      'Ana prefere TÓPICOS',
      'Suporte das 8h às 18h',
    ])
    const found = expectOk(
      await AiMemoryRepository.listVisible(workspace.id, ana.id, {
        q: 'tópicos',
      }),
    )
    expect(found.map((m) => m.content)).toEqual(['Ana prefere TÓPICOS'])
    expect(
      expectOk(
        await AiMemoryRepository.listVisible(workspace.id, ana.id, { take: 1 }),
      ),
    ).toHaveLength(1)
  })

  it('creates, edits, finds, soft-deletes', async () => {
    const [workspace, other, ana] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const created = expectOk(
      await AiMemoryRepository.create({
        workspaceId: workspace.id,
        scope: 'PERSONAL',
        userId: ana.id,
        content: 'Fato',
        source: 'AUTO',
        sourceConversationId: 'conv1',
        createdById: ana.id,
      }),
    )
    expect(
      expectOk(await AiMemoryRepository.findById(created.id, workspace.id))
        .content,
    ).toBe('Fato')
    expectErr(
      await AiMemoryRepository.findById(created.id, other.id),
      'AI_MEMORY_NOT_FOUND',
    )
    expect(
      expectOk(await AiMemoryRepository.updateContent(created.id, 'Novo'))
        .content,
    ).toBe('Novo')
    expectOk(await AiMemoryRepository.softDelete(created.id))
    expectErr(
      await AiMemoryRepository.findById(created.id, workspace.id),
      'AI_MEMORY_NOT_FOUND',
    )
  })

  it('stamps lastUsedAt without touching updatedAt', async () => {
    const workspace = await seedWorkspace()
    const updatedAt = new Date('2026-10-01T00:00:00Z')
    const a = await seedAiMemory(workspace.id, { updatedAt })
    const b = await seedAiMemory(workspace.id, { updatedAt })
    const at = new Date('2026-10-08T12:00:00Z')

    expect(expectOk(await AiMemoryRepository.touchUsed([], at))).toBe(0)
    expect(expectOk(await AiMemoryRepository.touchUsed([a.id, b.id], at))).toBe(
      2,
    )
    const row = await prisma.aiMemory.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.lastUsedAt?.toISOString()).toBe(at.toISOString())
    expect(row.updatedAt.toISOString()).toBe(updatedAt.toISOString())
  })

  it('returns DATABASE_ERROR when Prisma fails', async () => {
    vi.spyOn(prisma.aiMemory, 'findMany').mockRejectedValueOnce(new Error('x'))
    vi.spyOn(prisma.aiMemory, 'findFirst').mockRejectedValueOnce(new Error('x'))
    vi.spyOn(prisma.aiMemory, 'create').mockRejectedValueOnce(new Error('x'))
    vi.spyOn(prisma.aiMemory, 'update')
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
    vi.spyOn(prisma, '$executeRaw').mockRejectedValueOnce(new Error('x'))

    expectErr(await AiMemoryRepository.listVisible('w', 'u'), 'DATABASE_ERROR')
    expectErr(await AiMemoryRepository.findById('m', 'w'), 'DATABASE_ERROR')
    expectErr(
      await AiMemoryRepository.create({
        workspaceId: 'w',
        scope: 'WORKSPACE',
        userId: null,
        content: 'c',
        source: 'MANUAL',
        sourceConversationId: null,
        createdById: 'u',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiMemoryRepository.updateContent('m', 'c'),
      'DATABASE_ERROR',
    )
    expectErr(await AiMemoryRepository.softDelete('m'), 'DATABASE_ERROR')
    expectErr(
      await AiMemoryRepository.touchUsed(['m'], new Date()),
      'DATABASE_ERROR',
    )
  })
})
