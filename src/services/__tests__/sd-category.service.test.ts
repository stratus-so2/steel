import type { SdCategory } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdCategoryNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdCategorySchema } from '@/src/schemas/sd-category.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-category.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdCategoryRepository } from '@/src/repositories/sd-category.repository'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdCategoryService } from '../sd-category.service'

const repo = vi.mocked(SdCategoryRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)

function catRow(overrides: Partial<SdCategory> = {}): SdCategory {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: 'c1',
    workspaceId: 'ws1',
    parentId: null,
    level: 'CATEGORY',
    name: 'Infra',
    description: null,
    icon: null,
    ticketTypes: [],
    departmentId: null,
    slaPolicyId: null,
    portalVisible: true,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const rootInput = CreateSdCategorySchema.parse({
  level: 'CATEGORY',
  name: 'Infra',
  departmentId: 'd1',
})

beforeEach(() => {
  actAs('owner')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
  repo.list.mockResolvedValue(ok([catRow()]))
  repo.findById.mockResolvedValue(ok(catRow()))
  repo.countChildren.mockResolvedValue(ok(0))
  repo.create.mockResolvedValue(ok(catRow()))
  repo.update.mockResolvedValue(ok(catRow()))
  repo.delete.mockResolvedValue(ok(undefined))
  repo.reorder.mockResolvedValue(ok(undefined))
})

describe('SdCategoryService.list', () => {
  it('returns everything to agents (with includeInactive honored)', async () => {
    actAs('agent')
    expectOk(
      await SdCategoryService.list('u1', 'ws1', {
        includeInactive: true,
        ticketType: 'INCIDENT',
      }),
    )
    expect(repo.list).toHaveBeenCalledWith('ws1', {
      ticketType: 'INCIDENT',
      includeInactive: true,
    })
  })

  it('shows requesters only portal-visible nodes with visible ancestors', async () => {
    actAs('requester')
    repo.list.mockResolvedValue(
      ok([
        catRow({ id: 'a' }),
        catRow({ id: 'hidden', portalVisible: false }),
        catRow({ id: 'b', parentId: 'a', level: 'SUBCATEGORY' }),
        catRow({ id: 'orphan', parentId: 'hidden', level: 'SUBCATEGORY' }),
      ]),
    )
    const list = expectOk(
      await SdCategoryService.list('u1', 'ws1', { includeInactive: true }),
    )
    expect(list.map((c) => c.id)).toEqual(['a', 'b'])
    expect(repo.list).toHaveBeenCalledWith('ws1', {
      ticketType: undefined,
      includeInactive: false,
    })
  })

  it('uses the default filter, refuses strangers, propagates db errors', async () => {
    expectOk(await SdCategoryService.list('u1', 'ws1'))
    actAs('stranger')
    expectErr(await SdCategoryService.list('u1', 'ws1'), 'FORBIDDEN')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdCategoryService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('SdCategoryService.create', () => {
  it('creates a root category and validates refs', async () => {
    expectOk(await SdCategoryService.create('u1', 'ws1', rootInput))
    expect(refs).toHaveBeenCalledWith('ws1', {
      departmentIds: ['d1'],
      slaPolicyIds: [],
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_category', targetId: 'c1' }),
    )
  })

  it('creates a subcategory and a service under the right parents', async () => {
    expectOk(
      await SdCategoryService.create('u1', 'ws1', {
        ...rootInput,
        parentId: 'c1',
        level: 'SUBCATEGORY',
      }),
    )
    repo.findById.mockResolvedValue(ok(catRow({ level: 'SUBCATEGORY' })))
    expectOk(
      await SdCategoryService.create('u1', 'ws1', {
        ...rootInput,
        parentId: 'c1',
        level: 'SERVICE',
      }),
    )
  })

  it('rejects a wrong level', async () => {
    const error = expectErr(
      await SdCategoryService.create('u1', 'ws1', {
        ...rootInput,
        level: 'SERVICE',
      }),
      'SD_CATEGORY_LEVEL_INVALID',
    )
    expect(error.message).toMatch(/categoria/)
  })

  it('rejects children under a service', async () => {
    repo.findById.mockResolvedValue(ok(catRow({ level: 'SERVICE' })))
    const error = expectErr(
      await SdCategoryService.create('u1', 'ws1', {
        ...rootInput,
        parentId: 'c1',
        level: 'SERVICE',
      }),
      'SD_CATEGORY_LEVEL_INVALID',
    )
    expect(error.message).toMatch(/serviço não pode ter filhos/)
  })

  it('returns not found for a foreign parent, refs and db errors', async () => {
    repo.findById.mockResolvedValue(err(sdCategoryNotFound()))
    expectErr(
      await SdCategoryService.create('u1', 'ws1', {
        ...rootInput,
        parentId: 'x',
        level: 'SUBCATEGORY',
      }),
      'SD_CATEGORY_NOT_FOUND',
    )
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdCategoryService.create('u1', 'ws1', rootInput),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCategoryService.create('u1', 'ws1', rootInput),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('refuses %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdCategoryService.create('u1', 'ws1', rootInput), code)
  })
})

describe('SdCategoryService.update', () => {
  it('updates plain fields without level checks', async () => {
    expectOk(await SdCategoryService.update('u1', 'ws1', 'c1', { name: 'X' }))
    expect(repo.countChildren).not.toHaveBeenCalled()
    expect(repo.update).toHaveBeenCalledWith('c1', 'ws1', { name: 'X' })
  })

  it('moves a leaf to a new parent changing level', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(catRow({ id: 'c2' })))
      .mockResolvedValueOnce(ok(catRow({ id: 'c1' })))
    expectOk(
      await SdCategoryService.update('u1', 'ws1', 'c2', {
        parentId: 'c1',
        level: 'SUBCATEGORY',
      }),
    )
    expect(repo.countChildren).toHaveBeenCalledWith('c2')
  })

  it('keeps the existing parent when only the level is sent', async () => {
    repo.findById.mockResolvedValueOnce(
      ok(catRow({ id: 'c2', parentId: null })),
    )
    expectOk(
      await SdCategoryService.update('u1', 'ws1', 'c2', { level: 'CATEGORY' }),
    )
    expect(repo.countChildren).not.toHaveBeenCalled()
  })

  it('refuses to parent itself', async () => {
    expectErr(
      await SdCategoryService.update('u1', 'ws1', 'c1', { parentId: 'c1' }),
      'SD_CATEGORY_LEVEL_INVALID',
    )
  })

  it('refuses a level change for a node with children', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(catRow({ id: 'c2' })))
      .mockResolvedValueOnce(ok(catRow({ id: 'c1' })))
    repo.countChildren.mockResolvedValue(ok(3))
    expectErr(
      await SdCategoryService.update('u1', 'ws1', 'c2', {
        parentId: 'c1',
        level: 'SUBCATEGORY',
      }),
      'SD_CATEGORY_LEVEL_INVALID',
    )
    repo.findById
      .mockResolvedValueOnce(ok(catRow({ id: 'c2' })))
      .mockResolvedValueOnce(ok(catRow({ id: 'c1' })))
    repo.countChildren.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCategoryService.update('u1', 'ws1', 'c2', {
        parentId: 'c1',
        level: 'SUBCATEGORY',
      }),
      'DATABASE_ERROR',
    )
  })

  it('refuses an invalid level on move', async () => {
    expectErr(
      await SdCategoryService.update('u1', 'ws1', 'c1', {
        parentId: null,
        level: 'SERVICE',
      }),
      'SD_CATEGORY_LEVEL_INVALID',
    )
  })

  it('returns not found, ref and db errors', async () => {
    repo.findById.mockResolvedValueOnce(err(sdCategoryNotFound()))
    expectErr(
      await SdCategoryService.update('u1', 'ws1', 'x', { name: 'a' }),
      'SD_CATEGORY_NOT_FOUND',
    )
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdCategoryService.update('u1', 'ws1', 'c1', { slaPolicyId: 'p' }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCategoryService.update('u1', 'ws1', 'c1', { name: 'a' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdCategoryService.remove / reorder', () => {
  it('deletes and returns not found', async () => {
    expectOk(await SdCategoryService.remove('u1', 'ws1', 'c1'))
    expect(repo.delete).toHaveBeenCalledWith('c1', 'ws1')
    repo.findById.mockResolvedValue(err(sdCategoryNotFound()))
    expectErr(
      await SdCategoryService.remove('u1', 'ws1', 'c1'),
      'SD_CATEGORY_NOT_FOUND',
    )
  })

  it('reorders for admins only', async () => {
    expectOk(await SdCategoryService.reorder('u1', 'ws1', ['c1']))
    expect(repo.reorder).toHaveBeenCalledWith('ws1', ['c1'])
    actAs('requester')
    expectErr(await SdCategoryService.reorder('u1', 'ws1', ['c1']), 'FORBIDDEN')
  })
})
