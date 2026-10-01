import { Prisma, type SdPart } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdTicketPart } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import {
  databaseError,
  sdConfigNotFound,
  sdNotAgent,
  sdPartOutOfStock,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdTicketPartSchema } from '@/src/schemas/sd-ticket-part.schema'
import type { SdTicketEventInput } from '@/src/services/sd-ticket-event-recorder'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/sd-ticket-part.repository')
vi.mock('@/src/repositories/sd-part.repository')
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { touchActivity: vi.fn() },
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { SdPartRepository } from '@/src/repositories/sd-part.repository'
import { SdTicketPartRepository } from '@/src/repositories/sd-ticket-part.repository'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { SdTicketPartService } from '../sd-ticket-part.service'
import { loadSdTicketTab, publishSdTicketTab } from '../sd-ticket-tab-support'

/** O recorder aceita um evento ou uma lista; os testes olham o primeiro. */
function sdEventAction(
  input: SdTicketEventInput | SdTicketEventInput[] | undefined,
): string | undefined {
  if (!input) return undefined
  return Array.isArray(input) ? input[0]?.action : input.action
}

const load = vi.mocked(loadSdTicketTab)
const repo = vi.mocked(SdTicketPartRepository)
const catalog = vi.mocked(SdPartRepository)
const record = vi.mocked(recordSdTicketEvent)

const now = new Date('2026-09-21T12:00:00Z')
function catalogPart(over: Partial<SdPart> = {}): SdPart {
  return {
    id: 'p1',
    workspaceId: 'ws1',
    name: 'Fonte ATX',
    sku: 'FNT-500',
    description: null,
    unitCost: new Prisma.Decimal('199.9'),
    stock: 10,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...over,
  }
}
const tracked = (over: Parameters<typeof createFakeSdTicketPart>[0] = {}) =>
  createFakeSdTicketPart({
    id: 'tp1',
    partId: 'p1',
    quantity: 2,
    part: { id: 'p1', stock: 10 },
    ...over,
  })

beforeEach(() => {
  load.mockResolvedValue(ok(sdTabScope()))
  catalog.findById.mockResolvedValue(ok(catalogPart()))
  repo.create.mockImplementation(async (data) =>
    ok(
      createFakeSdTicketPart({
        ...data,
        id: 'tp1',
        unitCost: new Prisma.Decimal(data.unitCost ?? '0'),
      }),
    ),
  )
  repo.findById.mockResolvedValue(ok(tracked()))
  repo.update.mockImplementation(async (id, data) =>
    ok(tracked({ id, ...data, unitCost: new Prisma.Decimal('250') })),
  )
  repo.delete.mockResolvedValue(ok(undefined))
})

describe('list', () => {
  it('lists with summary', async () => {
    repo.list.mockResolvedValue(
      ok([tracked({ status: 'INSTALLED' }), tracked({ status: 'CANCELED' })]),
    )
    const out = expectOk(await SdTicketPartService.list('u1', 'ws1', 't1'))
    expect(out.summary).toEqual({
      total: '500.00',
      installed: '500.00',
      count: 1,
    })
    expect(out.items[0]?.nextStatuses).toEqual(['RETURNED'])
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await SdTicketPartService.list('r', 'ws1', 't1'), 'SD_NOT_AGENT')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketPartService.list('u1', 'ws1', 't1'))
  })
})

describe('create', () => {
  it('fills name/sku/cost from the catalog (no stock move when requested)', async () => {
    const dto = expectOk(
      await SdTicketPartService.create(
        'u1',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({ partId: 'p1', quantity: 2 }),
      ),
    )
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        partId: 'p1',
        name: 'Fonte ATX',
        sku: 'FNT-500',
        unitCost: '199.90',
        status: 'REQUESTED',
        serialNumber: null,
        notes: null,
      }),
      null,
    )
    expect(dto.total).toBe('399.80')
    expect(catalog.findById).toHaveBeenCalledWith('p1', 'ws1')
    expect(sdEventAction(record.mock.calls[0]?.[0])).toBe('part.added')
    expect(publishSdTicketTab).toHaveBeenCalledWith(
      expect.anything(),
      'ticket.part',
      'u1',
      true,
    )
  })

  it('installing a tracked catalog part decrements stock', async () => {
    expectOk(
      await SdTicketPartService.create(
        'u1',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({
          partId: 'p1',
          quantity: 3,
          status: 'INSTALLED',
          name: 'Fonte customizada',
          sku: null,
          unitCost: '180',
        }),
      ),
    )
    const [data, stock] = repo.create.mock.calls[0] ?? []
    expect(data).toMatchObject({
      name: 'Fonte customizada',
      sku: null,
      unitCost: '180.00',
    })
    expect(stock).toEqual({ workspaceId: 'ws1', partId: 'p1', delta: -3 })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ stockDelta: -3 }),
      }),
    )
  })

  it('untracked stock and free-text parts never move stock', async () => {
    catalog.findById.mockResolvedValue(ok(catalogPart({ stock: null })))
    expectOk(
      await SdTicketPartService.create(
        'u1',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({ partId: 'p1', status: 'INSTALLED' }),
      ),
    )
    expect(repo.create.mock.calls[0]?.[1]).toBeNull()

    expectOk(
      await SdTicketPartService.create(
        'u1',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({
          name: 'Cabo avulso',
          status: 'INSTALLED',
        }),
      ),
    )
    const [free, stock] = repo.create.mock.calls[1] ?? []
    expect(free).toMatchObject({
      partId: null,
      name: 'Cabo avulso',
      sku: null,
      unitCost: '0.00',
    })
    expect(stock).toBeNull()
    expect(catalog.findById).toHaveBeenCalledTimes(1)
  })

  it('rejects inactive or unknown catalog parts and propagates errors', async () => {
    catalog.findById.mockResolvedValueOnce(ok(catalogPart({ active: false })))
    expectErr(
      await SdTicketPartService.create(
        'u1',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({ partId: 'p1' }),
      ),
      'VALIDATION_ERROR',
    )
    catalog.findById.mockResolvedValueOnce(err(sdConfigNotFound()))
    expectErr(
      await SdTicketPartService.create(
        'u1',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({ partId: 'nope' }),
      ),
      'SD_CONFIG_NOT_FOUND',
    )
    repo.create.mockResolvedValueOnce(err(sdPartOutOfStock()))
    expectErr(
      await SdTicketPartService.create(
        'u1',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({ partId: 'p1', status: 'INSTALLED' }),
      ),
      'SD_PART_OUT_OF_STOCK',
    )
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await SdTicketPartService.create(
        'r',
        'ws1',
        't1',
        CreateSdTicketPartSchema.parse({ name: 'x' }),
      ),
      'SD_NOT_AGENT',
    )
  })
})

describe('update', () => {
  it('REQUESTED → INSTALLED decrements (with the new quantity)', async () => {
    const dto = expectOk(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        status: 'INSTALLED',
        quantity: 4,
      }),
    )
    expect(repo.update).toHaveBeenCalledWith(
      'tp1',
      { status: 'INSTALLED', quantity: 4 },
      { workspaceId: 'ws1', partId: 'p1', delta: -4 },
    )
    expect(dto.status).toBe('INSTALLED')
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      action: 'part.status_changed',
      field: 'status',
      fromValue: 'REQUESTED',
      toValue: 'INSTALLED',
    })
  })

  it('INSTALLED → RETURNED restores the installed quantity', async () => {
    repo.findById.mockResolvedValue(ok(tracked({ status: 'INSTALLED' })))
    expectOk(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        status: 'RETURNED',
      }),
    )
    expect(repo.update.mock.calls[0]?.[2]).toEqual({
      workspaceId: 'ws1',
      partId: 'p1',
      delta: 2,
    })
  })

  it('other edits keep stock; free-text parts never move it', async () => {
    expectOk(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        serialNumber: 'SN-1',
      }),
    )
    expect(repo.update.mock.calls[0]?.[2]).toBeNull()
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      action: 'part.updated',
      field: null,
      fromValue: null,
    })

    repo.findById.mockResolvedValue(
      ok(createFakeSdTicketPart({ id: 'tp1', status: 'RESERVED' })),
    )
    expectOk(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        status: 'INSTALLED',
      }),
    )
    expect(repo.update.mock.calls[1]?.[2]).toBeNull()

    repo.findById.mockResolvedValue(
      ok(tracked({ status: 'INSTALLED', part: { id: 'p1', stock: null } })),
    )
    expectOk(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        status: 'RETURNED',
      }),
    )
    expect(repo.update.mock.calls[2]?.[2]).toBeNull()
  })

  it('blocks invalid transitions and quantity edits of installed parts', async () => {
    repo.findById.mockResolvedValue(ok(tracked({ status: 'RETURNED' })))
    const invalid = expectErr(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        status: 'INSTALLED',
      }),
      'SD_PART_STATUS_INVALID',
    )
    expect(invalid.message).toBe(
      'Não é possível passar de Devolvida para Instalada',
    )
    repo.findById.mockResolvedValue(ok(tracked({ status: 'INSTALLED' })))
    expectErr(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        quantity: 5,
      }),
      'VALIDATION_ERROR',
    )
    expectOk(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        quantity: 2,
        notes: 'ok',
      }),
    )
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await SdTicketPartService.update('r', 'ws1', 't1', 'tp1', { notes: 'x' }),
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        notes: 'x',
      }),
    )
    repo.update.mockResolvedValueOnce(err(sdPartOutOfStock()))
    expectErr(
      await SdTicketPartService.update('u1', 'ws1', 't1', 'tp1', {
        status: 'INSTALLED',
      }),
      'SD_PART_OUT_OF_STOCK',
    )
  })
})

describe('remove', () => {
  it('returns installed tracked parts to stock', async () => {
    repo.findById.mockResolvedValue(ok(tracked({ status: 'INSTALLED' })))
    expectOk(await SdTicketPartService.remove('u1', 'ws1', 't1', 'tp1'))
    expect(repo.delete).toHaveBeenCalledWith('tp1', {
      workspaceId: 'ws1',
      partId: 'p1',
      delta: 2,
    })
    expect(sdEventAction(record.mock.calls[0]?.[0])).toBe('part.removed')
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'DELETE', {
      agentOnly: true,
      requireOpen: true,
    })
  })

  it('does not move stock for requested parts', async () => {
    expectOk(await SdTicketPartService.remove('u1', 'ws1', 't1', 'tp1'))
    expect(repo.delete).toHaveBeenCalledWith('tp1', null)
    repo.findById.mockResolvedValue(
      ok(tracked({ status: 'INSTALLED', partId: null, part: null })),
    )
    expectOk(await SdTicketPartService.remove('u1', 'ws1', 't1', 'tp1'))
    expect(repo.delete).toHaveBeenLastCalledWith('tp1', null)
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await SdTicketPartService.remove('r', 'ws1', 't1', 'tp1'))
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketPartService.remove('u1', 'ws1', 't1', 'tp1'))
    repo.delete.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketPartService.remove('u1', 'ws1', 't1', 'tp1'),
      'DATABASE_ERROR',
    )
  })
})
