import type { SdCustomFieldDefinition } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-custom-field.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdCustomFieldRepository } from '@/src/repositories/sd-custom-field.repository'
import { SdCustomFieldService } from '../sd-custom-field.service'

const repo = vi.mocked(SdCustomFieldRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)
const WS = 'ws1'
const options = [{ value: 'a', label: 'A', color: null }]

function field(
  overrides: Partial<SdCustomFieldDefinition> = {},
): SdCustomFieldDefinition {
  const now = new Date()
  return {
    id: 'f1',
    workspaceId: WS,
    entity: 'TICKET',
    key: 'contrato',
    label: 'Contrato',
    description: null,
    type: 'TEXT',
    options: [],
    ticketTypes: [],
    categoryIds: [],
    required: false,
    visibleInPortal: false,
    defaultValue: null,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const createDto = {
  entity: 'TICKET' as const,
  key: 'nivel',
  label: 'Nível',
  type: 'SELECT' as const,
  options,
  ticketTypes: [],
  categoryIds: ['c1'],
  required: false,
  visibleInPortal: true,
  defaultValue: 'a',
  active: true,
}

beforeEach(() => {
  actAs('owner')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
})

describe('SdCustomFieldService.list', () => {
  it('returns everything to agents honoring includeInactive', async () => {
    actAs('agent')
    repo.list.mockResolvedValue(
      ok([field(), field({ id: 'f2', visibleInPortal: true })]),
    )
    const list = expectOk(
      await SdCustomFieldService.list('u1', WS, {
        entity: 'TICKET',
        includeInactive: true,
      }),
    )
    expect(list).toHaveLength(2)
    expect(repo.list).toHaveBeenCalledWith(WS, {
      entity: 'TICKET',
      includeInactive: true,
    })
  })

  it('returns only portal-visible active fields to requesters', async () => {
    actAs('requester')
    repo.list.mockResolvedValue(
      ok([field(), field({ id: 'f2', visibleInPortal: true })]),
    )
    const list = expectOk(
      await SdCustomFieldService.list('u1', WS, { includeInactive: true }),
    )
    expect(list.map((f) => f.id)).toEqual(['f2'])
    expect(repo.list).toHaveBeenCalledWith(WS, {
      entity: undefined,
      includeInactive: false,
    })
  })

  it('uses default filters, denies strangers and propagates errors', async () => {
    repo.list.mockResolvedValue(ok([]))
    expectOk(await SdCustomFieldService.list('u1', WS))
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdCustomFieldService.list('u1', WS), 'DATABASE_ERROR')
    actAs('stranger')
    expectErr(await SdCustomFieldService.list('u1', WS), 'FORBIDDEN')
  })
})

describe('SdCustomFieldService.create', () => {
  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdCustomFieldService.create('u1', WS, createDto), code)
  })

  it('creates with a validated default', async () => {
    repo.create.mockResolvedValue(
      ok(field({ type: 'SELECT', options, defaultValue: 'a' })),
    )
    const created = expectOk(
      await SdCustomFieldService.create('u1', WS, createDto),
    )
    expect(created.defaultValue).toBe('a')
    expect(repo.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ defaultValue: 'a', key: 'nivel' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_custom_field_definition',
        action: 'create',
      }),
    )
  })

  it('stores JsonNull when there is no default', async () => {
    repo.create.mockResolvedValue(ok(field()))
    expectOk(
      await SdCustomFieldService.create('u1', WS, {
        ...createDto,
        defaultValue: null,
      }),
    )
    expect(repo.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ defaultValue: Prisma.JsonNull }),
    )
  })

  it('refuses an invalid default', async () => {
    const e = expectErr(
      await SdCustomFieldService.create('u1', WS, {
        ...createDto,
        defaultValue: 'zzz',
      }),
      'SD_CUSTOM_FIELD_INVALID',
    )
    expect(e.message).toMatch(/Valor padrão/)
  })

  it('refuses unknown categories and propagates create errors', async () => {
    refs.mockResolvedValue(ok({ categoryIds: [] }))
    expectErr(
      await SdCustomFieldService.create('u1', WS, createDto),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCustomFieldService.create('u1', WS, createDto),
      'DATABASE_ERROR',
    )
  })
})

describe('SdCustomFieldService.update', () => {
  it('keeps stored options/default when not sent', async () => {
    repo.findById.mockResolvedValue(
      ok(field({ type: 'SELECT', options, defaultValue: 'a' })),
    )
    repo.update.mockResolvedValue(ok(field({ label: 'Novo' })))
    expectOk(
      await SdCustomFieldService.update('u1', WS, 'f1', { label: 'Novo' }),
    )
    expect(repo.update).toHaveBeenCalledWith(
      'f1',
      WS,
      expect.objectContaining({ label: 'Novo', defaultValue: 'a' }),
    )
  })

  it('refuses emptying the options of a select', async () => {
    repo.findById.mockResolvedValue(
      ok(field({ type: 'MULTI_SELECT', options })),
    )
    expectErr(
      await SdCustomFieldService.update('u1', WS, 'f1', { options: [] }),
      'SD_CUSTOM_FIELD_INVALID',
    )
  })

  it('refuses a default that no longer matches the options', async () => {
    repo.findById.mockResolvedValue(
      ok(field({ type: 'SELECT', options, defaultValue: 'a' })),
    )
    expectErr(
      await SdCustomFieldService.update('u1', WS, 'f1', {
        options: [{ value: 'b', label: 'B' }],
      }),
      'SD_CUSTOM_FIELD_INVALID',
    )
  })

  it('accepts a new default and clearing it', async () => {
    repo.findById.mockResolvedValue(ok(field({ type: 'NUMBER' })))
    repo.update.mockResolvedValue(ok(field()))
    expectOk(
      await SdCustomFieldService.update('u1', WS, 'f1', { defaultValue: '12' }),
    )
    expect(repo.update).toHaveBeenLastCalledWith(
      'f1',
      WS,
      expect.objectContaining({ defaultValue: 12 }),
    )
    expectOk(
      await SdCustomFieldService.update('u1', WS, 'f1', { defaultValue: null }),
    )
    expect(repo.update).toHaveBeenLastCalledWith(
      'f1',
      WS,
      expect.objectContaining({ defaultValue: Prisma.JsonNull }),
    )
  })

  it('propagates errors and validates categories', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCustomFieldService.update('u1', WS, 'f1', { label: 'x' }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(field()))
    refs.mockResolvedValue(ok({ categoryIds: [] }))
    expectErr(
      await SdCustomFieldService.update('u1', WS, 'f1', {
        categoryIds: ['c9'],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCustomFieldService.update('u1', WS, 'f1', { label: 'x' }),
      'DATABASE_ERROR',
    )
  })

  it('denies non-admins', async () => {
    actAs('agent')
    expectErr(
      await SdCustomFieldService.update('u1', WS, 'f1', { label: 'x' }),
      'FORBIDDEN',
    )
  })
})

describe('SdCustomFieldService.remove/reorder', () => {
  it('removes and reorders', async () => {
    repo.findById.mockResolvedValue(ok(field()))
    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdCustomFieldService.remove('u1', WS, 'f1'))
    expect(repo.delete).toHaveBeenCalledWith('f1', WS)
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCustomFieldService.remove('u1', WS, 'f1'),
      'DATABASE_ERROR',
    )
    repo.reorder.mockResolvedValue(ok(undefined))
    expectOk(await SdCustomFieldService.reorder('u1', WS, ['f1']))
    expect(repo.reorder).toHaveBeenCalledWith(WS, ['f1'])
  })

  it('denies non-admins', async () => {
    actAs('requester')
    expectErr(await SdCustomFieldService.remove('u1', WS, 'f1'), 'FORBIDDEN')
    expectErr(await SdCustomFieldService.reorder('u1', WS, ['f1']), 'FORBIDDEN')
  })
})
