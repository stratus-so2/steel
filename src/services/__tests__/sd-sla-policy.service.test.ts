import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdConfigNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdSlaPolicyWithTargets } from '@/src/repositories/sd-sla-policy.repository'
import { CreateSdSlaPolicySchema } from '@/src/schemas/sd-sla-policy.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-sla-policy.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdSlaPolicyRepository } from '@/src/repositories/sd-sla-policy.repository'
import { SdSlaPolicyService } from '../sd-sla-policy.service'

const repo = vi.mocked(SdSlaPolicyRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)

function policyRow(
  overrides: Partial<SdSlaPolicyWithTargets> = {},
): SdSlaPolicyWithTargets {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: 'p1',
    workspaceId: 'ws1',
    kind: 'SLA',
    name: 'Padrão',
    description: null,
    calendarId: null,
    conditions: [],
    isDefault: false,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    targets: [
      {
        id: 't1',
        policyId: 'p1',
        priorityId: 'pr1',
        firstResponseMinutes: 30,
        resolutionMinutes: 240,
      },
    ],
    ...overrides,
  }
}

const input = CreateSdSlaPolicySchema.parse({
  name: 'Padrão',
  calendarId: 'c1',
  targets: [
    { priorityId: 'pr1', firstResponseMinutes: 30, resolutionMinutes: 240 },
  ],
})

beforeEach(() => {
  actAs('owner')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
  repo.list.mockResolvedValue(ok([policyRow()]))
  repo.findById.mockResolvedValue(ok(policyRow()))
  repo.countDefaults.mockResolvedValue(ok(1))
  repo.create.mockResolvedValue(ok(policyRow()))
  repo.update.mockResolvedValue(ok(policyRow({ name: 'X' })))
  repo.delete.mockResolvedValue(ok(undefined))
  repo.reorder.mockResolvedValue(ok(undefined))
})

describe('SdSlaPolicyService.list', () => {
  it('lets any member read', async () => {
    actAs('requester')
    const [policy] = expectOk(await SdSlaPolicyService.list('u1', 'ws1'))
    expect(policy.targets).toEqual([
      { priorityId: 'pr1', firstResponseMinutes: 30, resolutionMinutes: 240 },
    ])
  })

  it('refuses strangers and propagates db errors', async () => {
    actAs('stranger')
    expectErr(await SdSlaPolicyService.list('u1', 'ws1'), 'FORBIDDEN')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdSlaPolicyService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('SdSlaPolicyService.create', () => {
  it('creates with targets and validates calendar/priorities', async () => {
    expectOk(await SdSlaPolicyService.create('u1', 'ws1', input))
    expect(refs).toHaveBeenCalledWith('ws1', {
      calendarIds: ['c1'],
      priorityIds: ['pr1'],
    })
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ name: 'Padrão', isDefault: false }),
      input.targets,
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_sla_policy', targetId: 'p1' }),
    )
  })

  it('makes the first policy the default', async () => {
    repo.countDefaults.mockResolvedValue(ok(0))
    expectOk(await SdSlaPolicyService.create('u1', 'ws1', input))
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ isDefault: true }),
      expect.any(Array),
    )
  })

  it('rejects foreign priorities', async () => {
    refs.mockResolvedValue(ok({ calendarIds: ['c1'] }))
    const error = expectErr(
      await SdSlaPolicyService.create('u1', 'ws1', input),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(error.details).toEqual({
      missing: [{ kind: 'priorityIds', id: 'pr1' }],
    })
  })

  it('propagates db errors', async () => {
    repo.countDefaults.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdSlaPolicyService.create('u1', 'ws1', input),
      'DATABASE_ERROR',
    )
    repo.countDefaults.mockResolvedValue(ok(1))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdSlaPolicyService.create('u1', 'ws1', input),
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
    expectErr(await SdSlaPolicyService.create('u1', 'ws1', input), code)
  })
})

describe('SdSlaPolicyService.update', () => {
  it('updates and replaces targets', async () => {
    expectOk(
      await SdSlaPolicyService.update('u1', 'ws1', 'p1', {
        name: 'X',
        targets: input.targets,
      }),
    )
    expect(repo.update).toHaveBeenCalledWith(
      'p1',
      'ws1',
      { name: 'X' },
      input.targets,
    )
  })

  it('refuses to unset or deactivate the default policy', async () => {
    repo.findById.mockResolvedValue(ok(policyRow({ isDefault: true })))
    expectErr(
      await SdSlaPolicyService.update('u1', 'ws1', 'p1', { isDefault: false }),
      'SD_CONFIG_CONFLICT',
    )
    expectErr(
      await SdSlaPolicyService.update('u1', 'ws1', 'p1', { active: false }),
      'SD_CONFIG_CONFLICT',
    )
    expectOk(await SdSlaPolicyService.update('u1', 'ws1', 'p1', { name: 'ok' }))
  })

  it('returns not found, ref and db errors', async () => {
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdSlaPolicyService.update('u1', 'ws1', 'p1', { name: 'a' }),
      'SD_CONFIG_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(ok(policyRow()))
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdSlaPolicyService.update('u1', 'ws1', 'p1', { calendarId: 'x' }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdSlaPolicyService.update('u1', 'ws1', 'p1', { name: 'a' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdSlaPolicyService.remove', () => {
  it('deletes a non-default policy', async () => {
    expectOk(await SdSlaPolicyService.remove('u1', 'ws1', 'p1'))
    expect(repo.delete).toHaveBeenCalledWith('p1', 'ws1')
  })

  it('refuses the default policy and missing ones', async () => {
    repo.findById.mockResolvedValue(ok(policyRow({ isDefault: true })))
    expectErr(
      await SdSlaPolicyService.remove('u1', 'ws1', 'p1'),
      'SD_CONFIG_CONFLICT',
    )
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdSlaPolicyService.remove('u1', 'ws1', 'p1'),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdSlaPolicyService.reorder', () => {
  it('reorders for admins only', async () => {
    expectOk(await SdSlaPolicyService.reorder('u1', 'ws1', ['p2', 'p1']))
    expect(repo.reorder).toHaveBeenCalledWith('ws1', ['p2', 'p1'])
    actAs('agent')
    expectErr(
      await SdSlaPolicyService.reorder('u1', 'ws1', ['p1']),
      'FORBIDDEN',
    )
  })
})
