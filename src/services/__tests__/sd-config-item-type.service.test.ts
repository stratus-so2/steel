import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdConfigItemType } from '@/src/__tests__/factories/sd-config-item.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  asSdMember,
  asSdStranger,
} from '@/src/__tests__/helpers/sd-directory.helpers'
import { databaseError, sdConfigItemTypeNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config-item-type.repository')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigItemTypeRepository } from '@/src/repositories/sd-config-item-type.repository'
import { SdConfigItemTypeService } from '../sd-config-item-type.service'

const repo = vi.mocked(SdConfigItemTypeRepository)
const audit = vi.mocked(auditMutation)

beforeEach(() => {
  asSdMember('ADMIN')
  repo.nameTaken.mockResolvedValue(ok(false))
  repo.findById.mockResolvedValue(
    ok(createFakeSdConfigItemType({ id: 't1', _count: { items: 4 } })),
  )
})

describe('SdConfigItemTypeService', () => {
  it('lists types for agents (parsing the stored schema) and denies requesters', async () => {
    asSdMember('MEMBER')
    repo.list.mockResolvedValue(
      ok([
        createFakeSdConfigItemType({
          id: 't1',
          attributeSchema: [
            { key: 'a', label: 'A', type: 'text' },
            { broken: true },
          ],
          _count: { items: 2 },
        }),
      ]),
    )
    const list = expectOk(await SdConfigItemTypeService.list('u1', 'ws1'))
    expect(list[0]).toMatchObject({
      id: 't1',
      attributeSchema: [{ key: 'a', label: 'A', type: 'text' }],
      itemsCount: 2,
    })

    repo.list.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdConfigItemTypeService.list('u1', 'ws1'), 'DATABASE_ERROR')

    asSdMember('MEMBER', { agent: false })
    expectErr(await SdConfigItemTypeService.list('u1', 'ws1'), 'SD_NOT_AGENT')
    asSdStranger()
    expectErr(await SdConfigItemTypeService.list('u1', 'ws1'), 'FORBIDDEN')
  })

  it('restricts mutations to ServiceDesk admins', async () => {
    asSdMember('MEMBER')
    expectErr(
      await SdConfigItemTypeService.create('u1', 'ws1', {
        name: 'X',
        attributeSchema: [],
      }),
      'FORBIDDEN',
    )
    expectErr(
      await SdConfigItemTypeService.update('u1', 'ws1', 't1', { name: 'X' }),
      'FORBIDDEN',
    )
    expectErr(
      await SdConfigItemTypeService.remove('u1', 'ws1', 't1'),
      'FORBIDDEN',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('creates with a unique name and audits', async () => {
    repo.create.mockResolvedValue(ok(createFakeSdConfigItemType({ id: 't9' })))
    const dto = expectOk(
      await SdConfigItemTypeService.create('u1', 'ws1', {
        name: 'Servidor',
        attributeSchema: [{ key: 'os', label: 'SO', type: 'text' }],
      }),
    )
    expect(dto.id).toBe('t9')
    expect(repo.nameTaken).toHaveBeenCalledWith('ws1', 'Servidor', undefined)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_config_item_type',
        action: 'create',
      }),
    )

    repo.nameTaken.mockResolvedValueOnce(ok(true))
    expectErr(
      await SdConfigItemTypeService.create('u1', 'ws1', {
        name: 'Servidor',
        attributeSchema: [],
      }),
      'SD_CONFIG_CONFLICT',
    )
    repo.nameTaken.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdConfigItemTypeService.create('u1', 'ws1', {
        name: 'Servidor',
        attributeSchema: [],
      }),
      'DATABASE_ERROR',
    )
    repo.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdConfigItemTypeService.create('u1', 'ws1', {
        name: 'Outro',
        attributeSchema: [],
      }),
      'DATABASE_ERROR',
    )
  })

  it('updates excluding itself from the name check', async () => {
    repo.update.mockResolvedValue(ok(createFakeSdConfigItemType({ id: 't1' })))
    expectOk(
      await SdConfigItemTypeService.update('u1', 'ws1', 't1', {
        name: 'Servidores',
      }),
    )
    expect(repo.nameTaken).toHaveBeenCalledWith('ws1', 'Servidores', 't1')

    expectOk(
      await SdConfigItemTypeService.update('u1', 'ws1', 't1', { color: null }),
    )
    expect(repo.nameTaken).toHaveBeenCalledTimes(1)

    repo.findById.mockResolvedValueOnce(err(sdConfigItemTypeNotFound()))
    expectErr(
      await SdConfigItemTypeService.update('u1', 'ws1', 't1', { name: 'X' }),
      'SD_CONFIG_ITEM_TYPE_NOT_FOUND',
    )
    repo.nameTaken.mockResolvedValueOnce(ok(true))
    expectErr(
      await SdConfigItemTypeService.update('u1', 'ws1', 't1', { name: 'X' }),
      'SD_CONFIG_CONFLICT',
    )
    repo.update.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdConfigItemTypeService.update('u1', 'ws1', 't1', { icon: 'x' }),
      'DATABASE_ERROR',
    )
  })

  it('deletes and audits the number of affected items', async () => {
    repo.delete.mockResolvedValueOnce(ok(undefined))
    expectOk(await SdConfigItemTypeService.remove('u1', 'ws1', 't1'))
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        meta: { workspaceId: 'ws1', items: 4 },
      }),
    )
    repo.delete.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdConfigItemTypeService.remove('u1', 'ws1', 't1'),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValueOnce(err(sdConfigItemTypeNotFound()))
    expectErr(
      await SdConfigItemTypeService.remove('u1', 'ws1', 't1'),
      'SD_CONFIG_ITEM_TYPE_NOT_FOUND',
    )
  })
})
