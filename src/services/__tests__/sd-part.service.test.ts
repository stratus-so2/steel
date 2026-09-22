import { Prisma, type SdPart } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-part.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdPartRepository } from '@/src/repositories/sd-part.repository'
import { SdPartService } from '../sd-part.service'

const repo = vi.mocked(SdPartRepository)
const WS = 'ws1'

function part(overrides: Partial<SdPart> = {}): SdPart {
  const now = new Date()
  return {
    id: 'p1',
    workspaceId: WS,
    name: 'Mouse',
    sku: 'MS-1',
    description: null,
    unitCost: new Prisma.Decimal('129.9'),
    stock: 5,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const dto = {
  name: 'Mouse',
  unitCost: '129.90',
  active: true,
}

beforeEach(() => {
  actAs('owner')
})

describe('SdPartService.list', () => {
  it('lists for agents with the decimal as string', async () => {
    actAs('agent')
    repo.list.mockResolvedValue(ok([part()]))
    const list = expectOk(
      await SdPartService.list('u1', WS, { q: 'mo', includeInactive: true }),
    )
    expect(list[0].unitCost).toBe('129.90')
    expect(repo.list).toHaveBeenCalledWith(WS, {
      q: 'mo',
      includeInactive: true,
    })
    expectOk(await SdPartService.list('u1', WS))
    expect(repo.list).toHaveBeenLastCalledWith(WS, { includeInactive: false })
  })

  it('refuses requesters and propagates errors', async () => {
    actAs('requester')
    expectErr(await SdPartService.list('u1', WS), 'SD_NOT_AGENT')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdPartService.list('u1', WS), 'DATABASE_ERROR')
  })
})

describe('SdPartService writes', () => {
  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdPartService.create('u1', WS, dto), code)
    expectErr(await SdPartService.update('u1', WS, 'p1', { name: 'x' }), code)
    expectErr(await SdPartService.remove('u1', WS, 'p1'), code)
  })

  it('creates, updates and removes', async () => {
    repo.create.mockResolvedValue(ok(part()))
    expectOk(await SdPartService.create('u1', WS, dto))
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_part',
        action: 'create',
        targetId: 'p1',
      }),
    )

    repo.findById.mockResolvedValue(ok(part()))
    repo.update.mockResolvedValue(ok(part({ stock: null })))
    const updated = expectOk(
      await SdPartService.update('u1', WS, 'p1', { stock: null }),
    )
    expect(updated.stock).toBeNull()

    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdPartService.remove('u1', WS, 'p1'))
    expect(repo.delete).toHaveBeenCalledWith('p1', WS)
  })

  it('propagates errors', async () => {
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(await SdPartService.create('u1', WS, dto), 'DATABASE_ERROR')
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPartService.update('u1', WS, 'p1', { name: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(await SdPartService.remove('u1', WS, 'p1'), 'DATABASE_ERROR')
    repo.findById.mockResolvedValue(ok(part()))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdPartService.update('u1', WS, 'p1', { name: 'x' }),
      'DATABASE_ERROR',
    )
  })
})
