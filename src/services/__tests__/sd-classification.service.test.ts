import type { SdClassification } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdConfigNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdClassificationSchema } from '@/src/schemas/sd-classification.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-classification.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdClassificationRepository } from '@/src/repositories/sd-classification.repository'
import { SdClassificationService } from '../sd-classification.service'

const repo = vi.mocked(SdClassificationRepository)

function row(overrides: Partial<SdClassification> = {}): SdClassification {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: 'k1',
    workspaceId: 'ws1',
    kind: 'TICKET',
    name: 'Falha',
    description: null,
    color: '#ef4444',
    ticketTypes: [],
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const input = CreateSdClassificationSchema.parse({
  kind: 'TICKET',
  name: 'Falha',
})

beforeEach(() => {
  actAs('owner')
  repo.list.mockResolvedValue(ok([row()]))
  repo.findById.mockResolvedValue(ok(row()))
  repo.create.mockResolvedValue(ok(row()))
  repo.update.mockResolvedValue(ok(row({ name: 'Erro' })))
  repo.delete.mockResolvedValue(ok(undefined))
  repo.reorder.mockResolvedValue(ok(undefined))
})

describe('SdClassificationService', () => {
  it('lists for any member with filters', async () => {
    actAs('requester')
    const list = expectOk(
      await SdClassificationService.list('u1', 'ws1', {
        kind: 'SOLUTION',
        includeInactive: true,
      }),
    )
    expect(list[0].name).toBe('Falha')
    expect(repo.list).toHaveBeenCalledWith('ws1', {
      kind: 'SOLUTION',
      includeInactive: true,
    })
    expectOk(await SdClassificationService.list('u1', 'ws1'))
  })

  it('list refuses strangers and propagates db errors', async () => {
    actAs('stranger')
    expectErr(await SdClassificationService.list('u1', 'ws1'), 'FORBIDDEN')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdClassificationService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('creates and audits', async () => {
    expectOk(await SdClassificationService.create('u1', 'ws1', input))
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_classification', targetId: 'k1' }),
    )
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdClassificationService.create('u1', 'ws1', input),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'DATABASE_ERROR' }),
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
    expectErr(await SdClassificationService.create('u1', 'ws1', input), code)
  })

  it('updates, with not found and db errors', async () => {
    const dto = expectOk(
      await SdClassificationService.update('u1', 'ws1', 'k1', { name: 'Erro' }),
    )
    expect(dto.name).toBe('Erro')
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdClassificationService.update('u1', 'ws1', 'k1', { name: 'x' }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdClassificationService.update('u1', 'ws1', 'k1', { name: 'x' }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('removes, with not found', async () => {
    expectOk(await SdClassificationService.remove('u1', 'ws1', 'k1'))
    expect(repo.delete).toHaveBeenCalledWith('k1', 'ws1')
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdClassificationService.remove('u1', 'ws1', 'k1'),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('reorders for admins only', async () => {
    expectOk(await SdClassificationService.reorder('u1', 'ws1', ['k1']))
    expect(repo.reorder).toHaveBeenCalledWith('ws1', ['k1'])
    actAs('agent')
    expectErr(
      await SdClassificationService.reorder('u1', 'ws1', ['k1']),
      'FORBIDDEN',
    )
  })
})
