import type { SdPriorityMatrix } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdConfigConflict, sdConfigNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdScaleRow } from '@/src/repositories/sd-priority.repository'
import { CreateSdScaleItemSchema } from '@/src/schemas/sd-priority.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-priority.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdPriorityRepository } from '@/src/repositories/sd-priority.repository'
import { SdPriorityService } from '../sd-priority.service'

const repo = vi.mocked(SdPriorityRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)

const now = new Date('2026-01-01T00:00:00Z')
function scaleRow(overrides: Partial<SdScaleRow> = {}): SdScaleRow {
  return {
    id: 'i1',
    workspaceId: 'ws1',
    name: 'Alto',
    level: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const cell: SdPriorityMatrix = {
  id: 'm1',
  workspaceId: 'ws1',
  impactId: 'i1',
  urgencyId: 'u1',
  priorityId: 'p1',
}

const input = CreateSdScaleItemSchema.parse({ name: 'Alto', level: 3 })

beforeEach(() => {
  actAs('owner')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
  repo.list.mockResolvedValue(ok([scaleRow()]))
  repo.findById.mockResolvedValue(ok(scaleRow()))
  repo.count.mockResolvedValue(ok(2))
  repo.create.mockResolvedValue(ok(scaleRow()))
  repo.update.mockResolvedValue(ok(scaleRow({ name: 'X' })))
  repo.delete.mockResolvedValue(ok(undefined))
  repo.listMatrix.mockResolvedValue(ok([cell]))
  repo.saveMatrix.mockResolvedValue(ok([cell]))
})

describe('SdPriorityService scales', () => {
  it('lists a scale for any member, mapping missing columns', async () => {
    actAs('requester')
    const [item] = expectOk(await SdPriorityService.list('u1', 'ws1', 'impact'))
    expect(item).toMatchObject({
      kind: 'impact',
      description: null,
      color: null,
      isDefault: false,
    })
    expect(repo.list).toHaveBeenCalledWith('impact', 'ws1')
  })

  it('list refuses strangers and propagates db errors', async () => {
    actAs('stranger')
    expectErr(await SdPriorityService.list('u1', 'ws1', 'urgency'), 'FORBIDDEN')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPriorityService.list('u1', 'ws1', 'urgency'),
      'DATABASE_ERROR',
    )
  })

  it('creates a non-priority item without counting', async () => {
    expectOk(await SdPriorityService.create('u1', 'ws1', 'severity', input))
    expect(repo.count).not.toHaveBeenCalled()
    expect(repo.create).toHaveBeenCalledWith('severity', 'ws1', {
      ...input,
      isDefault: false,
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_priority_scale',
        meta: expect.objectContaining({ kind: 'severity' }),
      }),
    )
  })

  it('makes the first priority the default', async () => {
    repo.count.mockResolvedValue(ok(0))
    expectOk(await SdPriorityService.create('u1', 'ws1', 'priority', input))
    expect(repo.create).toHaveBeenCalledWith(
      'priority',
      'ws1',
      expect.objectContaining({ isDefault: true }),
    )
  })

  it('keeps an explicit default and skips counting', async () => {
    expectOk(
      await SdPriorityService.create('u1', 'ws1', 'priority', {
        ...input,
        isDefault: true,
      }),
    )
    expect(repo.count).not.toHaveBeenCalled()
  })

  it('maps a duplicated level to SD_CONFIG_CONFLICT and db errors', async () => {
    repo.create.mockResolvedValue(err(sdConfigConflict('nível')))
    expectErr(
      await SdPriorityService.create('u1', 'ws1', 'impact', input),
      'SD_CONFIG_CONFLICT',
    )
    repo.count.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPriorityService.create('u1', 'ws1', 'priority', input),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('create refuses %s', async (actor, code) => {
    actAs(actor)
    expectErr(
      await SdPriorityService.create('u1', 'ws1', 'impact', input),
      code,
    )
  })

  it('updates, with not found and db errors', async () => {
    const dto = expectOk(
      await SdPriorityService.update('u1', 'ws1', 'priority', 'i1', {
        name: 'X',
      }),
    )
    expect(dto.name).toBe('X')
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPriorityService.update('u1', 'ws1', 'priority', 'i1', {
        name: 'X',
      }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdPriorityService.update('u1', 'ws1', 'priority', 'i1', {
        name: 'X',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('removes, with not found', async () => {
    expectOk(await SdPriorityService.remove('u1', 'ws1', 'urgency', 'i1'))
    expect(repo.delete).toHaveBeenCalledWith('urgency', 'i1', 'ws1')
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdPriorityService.remove('u1', 'ws1', 'urgency', 'i1'),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdPriorityService matrix', () => {
  it('reads the matrix for any member', async () => {
    actAs('viewer')
    expect(expectOk(await SdPriorityService.getMatrix('u1', 'ws1'))).toEqual([
      { impactId: 'i1', urgencyId: 'u1', priorityId: 'p1' },
    ])
    repo.listMatrix.mockResolvedValue(err(databaseError()))
    expectErr(await SdPriorityService.getMatrix('u1', 'ws1'), 'DATABASE_ERROR')
    actAs('stranger')
    expectErr(await SdPriorityService.getMatrix('u1', 'ws1'), 'FORBIDDEN')
  })

  it('saves the full grid after validating ids', async () => {
    const cells = [{ impactId: 'i1', urgencyId: 'u1', priorityId: 'p1' }]
    expectOk(await SdPriorityService.saveMatrix('u1', 'ws1', { cells }))
    expect(refs).toHaveBeenCalledWith('ws1', {
      impactIds: ['i1'],
      urgencyIds: ['u1'],
      priorityIds: ['p1'],
    })
    expect(repo.saveMatrix).toHaveBeenCalledWith('ws1', cells)
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_priority_matrix' }),
    )
  })

  it('rejects foreign ids and propagates db errors', async () => {
    const cells = [{ impactId: 'i1', urgencyId: 'u1', priorityId: 'px' }]
    refs.mockResolvedValue(ok({ impactIds: ['i1'], urgencyIds: ['u1'] }))
    const error = expectErr(
      await SdPriorityService.saveMatrix('u1', 'ws1', { cells }),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(error.details).toEqual({
      missing: [{ kind: 'priorityIds', id: 'px' }],
    })
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.saveMatrix.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPriorityService.saveMatrix('u1', 'ws1', { cells }),
      'DATABASE_ERROR',
    )
  })

  it('refuses non-admins', async () => {
    actAs('agent')
    expectErr(
      await SdPriorityService.saveMatrix('u1', 'ws1', { cells: [] }),
      'FORBIDDEN',
    )
  })
})
