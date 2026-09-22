import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdConfigItem,
  createFakeSdConfigItemType,
} from '@/src/__tests__/factories/sd-config-item.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  asSdMember,
  asSdStranger,
} from '@/src/__tests__/helpers/sd-directory.helpers'
import {
  databaseError,
  sdConfigItemNotFound,
  sdConfigItemTypeNotFound,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  CreateSdConfigItemSchema,
  ListSdConfigItemsSchema,
} from '@/src/schemas/sd-config-item.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config-item.repository')
vi.mock('@/src/repositories/sd-config-item-type.repository')
vi.mock('@/src/repositories/sd-customer.repository')
vi.mock('@/src/repositories/sd-contact.repository')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigItemRepository } from '@/src/repositories/sd-config-item.repository'
import { SdConfigItemTypeRepository } from '@/src/repositories/sd-config-item-type.repository'
import { SdContactRepository } from '@/src/repositories/sd-contact.repository'
import { SdCustomerRepository } from '@/src/repositories/sd-customer.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdConfigItemService } from '../sd-config-item.service'

const repo = vi.mocked(SdConfigItemRepository)
const types = vi.mocked(SdConfigItemTypeRepository)
const customers = vi.mocked(SdCustomerRepository)
const contacts = vi.mocked(SdContactRepository)
const audit = vi.mocked(auditMutation)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)

const create = (input: Record<string, unknown> = {}) =>
  CreateSdConfigItemSchema.parse({ name: 'SRV-01', ...input })
const listQuery = ListSdConfigItemsSchema.parse({})
const SERVER_TYPE = createFakeSdConfigItemType({ id: 't1' })

beforeEach(() => {
  asSdMember('MEMBER')
  types.findById.mockResolvedValue(ok(SERVER_TYPE))
  repo.listChain.mockResolvedValue(
    ok([{ id: 'p1', name: 'Rack', code: null, parentId: null }]),
  )
  repo.departmentExists.mockResolvedValue(ok(true))
  customers.findExistingIds.mockImplementation(async (_ws, ids) => ok(ids))
  contacts.isWorkspaceMember.mockResolvedValue(ok(true))
})

describe('SdConfigItemService', () => {
  describe('authorization', () => {
    it('denies non-members, disabled module and requesters', async () => {
      asSdStranger()
      expectErr(
        await SdConfigItemService.list('u1', 'ws1', listQuery),
        'FORBIDDEN',
      )
      asSdMember('MEMBER')
      moduleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await SdConfigItemService.list('u1', 'ws1', listQuery),
        'MODULE_DISABLED',
      )
      asSdMember('MEMBER', { agent: false })
      expectErr(
        await SdConfigItemService.get('u1', 'ws1', 'ci1'),
        'SD_NOT_AGENT',
      )
      expectErr(
        await SdConfigItemService.options('u1', 'ws1', { limit: 5 }),
        'SD_NOT_AGENT',
      )
    })

    it('denies VIEWER writes and MEMBER deletes', async () => {
      asSdMember('VIEWER')
      expectErr(
        await SdConfigItemService.create('u1', 'ws1', create()),
        'FORBIDDEN',
      )
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', { name: 'x' }),
        'FORBIDDEN',
      )
      asSdMember('MEMBER')
      expectErr(
        await SdConfigItemService.remove('u1', 'ws1', 'ci1'),
        'FORBIDDEN',
      )
      expect(repo.create).not.toHaveBeenCalled()
    })
  })

  describe('list() / get() / options()', () => {
    it('maps the page, hiding deleted relations', async () => {
      repo.list.mockResolvedValue(
        ok({
          items: [
            createFakeSdConfigItem({
              id: 'ci1',
              warrantyUntil: new Date('2027-01-01T00:00:00Z'),
              customer: {
                id: 'c1',
                name: 'Acme',
                kind: 'COMPANY',
                deletedAt: new Date(),
              },
              department: { id: 'd1', name: 'NOC', deletedAt: null },
              _count: { children: 2 },
            }),
          ],
          total: 1,
        }),
      )
      const page = expectOk(
        await SdConfigItemService.list('u1', 'ws1', listQuery),
      )
      expect(page.items[0]).toMatchObject({
        id: 'ci1',
        customer: null,
        department: { id: 'd1', name: 'NOC' },
        warrantyUntil: '2027-01-01T00:00:00.000Z',
        purchasedAt: null,
        childrenCount: 2,
      })
      repo.list.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdConfigItemService.list('u1', 'ws1', listQuery),
        'DATABASE_ERROR',
      )
    })

    it('returns the detail with ancestors (root first), children and tickets', async () => {
      repo.findById.mockResolvedValue(
        ok(createFakeSdConfigItem({ id: 'ci1', parentId: 'p1' })),
      )
      repo.listChain.mockResolvedValue(
        ok([
          { id: 'p1', name: 'Rack', code: null, parentId: 'root' },
          { id: 'root', name: 'DC', code: 'DC-1', parentId: null },
        ]),
      )
      repo.listChildren.mockResolvedValue(
        ok([
          {
            id: 'k1',
            name: 'Disco',
            code: null,
            status: 'ACTIVE',
            type: { name: 'Storage' },
            _count: { children: 0 },
          },
          {
            id: 'k2',
            name: 'Fonte',
            code: 'F1',
            status: 'MAINTENANCE',
            type: null,
            _count: { children: 3 },
          },
        ]),
      )
      repo.listRecentTickets.mockResolvedValue(ok([]))

      const detail = expectOk(await SdConfigItemService.get('u1', 'ws1', 'ci1'))
      expect(detail.ancestors).toEqual([
        { id: 'root', name: 'DC', code: 'DC-1' },
        { id: 'p1', name: 'Rack', code: null },
      ])
      expect(detail.children).toEqual([
        {
          id: 'k1',
          name: 'Disco',
          code: null,
          status: 'ACTIVE',
          typeName: 'Storage',
          childrenCount: 0,
        },
        {
          id: 'k2',
          name: 'Fonte',
          code: 'F1',
          status: 'MAINTENANCE',
          typeName: null,
          childrenCount: 3,
        },
      ])
      expect(repo.listChain).toHaveBeenCalledWith('ws1', 'p1')
    })

    it('skips the chain for root items and propagates detail errors', async () => {
      repo.findById.mockResolvedValue(ok(createFakeSdConfigItem({ id: 'ci1' })))
      repo.listChildren.mockResolvedValue(ok([]))
      repo.listRecentTickets.mockResolvedValue(ok([]))
      expect(
        expectOk(await SdConfigItemService.get('u1', 'ws1', 'ci1')).ancestors,
      ).toEqual([])
      expect(repo.listChain).not.toHaveBeenCalled()

      repo.listRecentTickets.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdConfigItemService.get('u1', 'ws1', 'ci1'),
        'DATABASE_ERROR',
      )
      repo.listChildren.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdConfigItemService.get('u1', 'ws1', 'ci1'),
        'DATABASE_ERROR',
      )
      repo.findById.mockResolvedValueOnce(
        ok(createFakeSdConfigItem({ parentId: 'p1' })),
      )
      repo.listChain.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdConfigItemService.get('u1', 'ws1', 'ci1'),
        'DATABASE_ERROR',
      )
      repo.findById.mockResolvedValueOnce(err(sdConfigItemNotFound()))
      expectErr(
        await SdConfigItemService.get('u1', 'ws1', 'ci1'),
        'SD_CONFIG_ITEM_NOT_FOUND',
      )
    })

    it('builds option labels', async () => {
      repo.options.mockResolvedValue(
        ok([
          {
            id: 'ci1',
            name: 'Link',
            code: 'LNK-1',
            type: { name: 'Link' },
            customer: { name: 'Acme' },
          },
          { id: 'ci2', name: 'Solto', code: null, type: null, customer: null },
        ]),
      )
      expect(
        expectOk(
          await SdConfigItemService.options('u1', 'ws1', {
            customerId: 'c1',
            limit: 10,
          }),
        ),
      ).toEqual([
        { id: 'ci1', label: 'Link', sublabel: 'LNK-1 · Link · Acme' },
        { id: 'ci2', label: 'Solto', sublabel: null },
      ])
      repo.options.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdConfigItemService.options('u1', 'ws1', { limit: 1 }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('validates references and attributes against the type', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdConfigItem({ id: 'ci1' })))
      expectOk(
        await SdConfigItemService.create(
          'u1',
          'ws1',
          create({
            typeId: 't1',
            parentId: 'p1',
            customerId: 'c1',
            departmentId: 'd1',
            ownerId: 'u2',
            attributes: { hostname: ' srv ', ram_gb: '64' },
            ipAddress: '10.0.0.1',
          }),
        ),
      )
      expect(types.findById).toHaveBeenCalledWith('t1', 'ws1')
      expect(repo.listChain).toHaveBeenCalledWith('ws1', 'p1')
      expect(customers.findExistingIds).toHaveBeenCalledWith('ws1', ['c1'])
      expect(repo.departmentExists).toHaveBeenCalledWith('ws1', 'd1')
      expect(contacts.isWorkspaceMember).toHaveBeenCalledWith('ws1', 'u2')
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          attributes: { hostname: 'srv', ram_gb: 64 },
          status: 'ACTIVE',
          criticality: 'MEDIUM',
        }),
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'sd_config_item',
          action: 'create',
          targetId: 'ci1',
        }),
      )
    })

    it('keeps free attributes (minus blanks) without a type', async () => {
      repo.create.mockResolvedValue(ok(createFakeSdConfigItem()))
      expectOk(
        await SdConfigItemService.create(
          'u1',
          'ws1',
          create({ attributes: { a: 'x', b: '', c: null, d: 2, e: false } }),
        ),
      )
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ attributes: { a: 'x', d: 2, e: false } }),
      )
      expect(types.findById).not.toHaveBeenCalled()
    })

    it('returns VALIDATION_ERROR with issues for invalid attributes', async () => {
      const error = expectErr(
        await SdConfigItemService.create(
          'u1',
          'ws1',
          create({ typeId: 't1', attributes: { ram_gb: 'x' } }),
        ),
        'VALIDATION_ERROR',
      )
      expect(error.details).toEqual([
        { key: 'ram_gb', message: 'RAM (GB): Deve ser um número' },
        { key: 'hostname', message: 'Hostname é obrigatório' },
      ])
    })

    it.each([
      [
        'type',
        () => types.findById.mockResolvedValue(err(sdConfigItemTypeNotFound())),
        { typeId: 'tx' },
        'SD_CONFIG_ITEM_TYPE_NOT_FOUND',
      ],
      [
        'parent',
        () => repo.listChain.mockResolvedValue(ok([])),
        { parentId: 'px' },
        'SD_CONFIG_ITEM_NOT_FOUND',
      ],
      [
        'parent lookup',
        () => repo.listChain.mockResolvedValue(err(databaseError())),
        { parentId: 'px' },
        'DATABASE_ERROR',
      ],
      [
        'customer',
        () => customers.findExistingIds.mockResolvedValue(ok([])),
        { customerId: 'cx' },
        'SD_CUSTOMER_NOT_FOUND',
      ],
      [
        'customer lookup',
        () => customers.findExistingIds.mockResolvedValue(err(databaseError())),
        { customerId: 'cx' },
        'DATABASE_ERROR',
      ],
      [
        'department',
        () => repo.departmentExists.mockResolvedValue(ok(false)),
        { departmentId: 'dx' },
        'SD_DEPARTMENT_NOT_FOUND',
      ],
      [
        'department lookup',
        () => repo.departmentExists.mockResolvedValue(err(databaseError())),
        { departmentId: 'dx' },
        'DATABASE_ERROR',
      ],
      [
        'owner',
        () => contacts.isWorkspaceMember.mockResolvedValue(ok(false)),
        { ownerId: 'ux' },
        'VALIDATION_ERROR',
      ],
      [
        'owner lookup',
        () =>
          contacts.isWorkspaceMember.mockResolvedValue(err(databaseError())),
        { ownerId: 'ux' },
        'DATABASE_ERROR',
      ],
    ] as const)('rejects an invalid %s reference', async (_label, arrange, input, code) => {
      arrange()
      expectErr(
        await SdConfigItemService.create('u1', 'ws1', create(input)),
        code,
      )
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('audits failed inserts', async () => {
      repo.create.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdConfigItemService.create('u1', 'ws1', create()),
        'DATABASE_ERROR',
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failure' }),
      )
    })
  })

  describe('update()', () => {
    beforeEach(() => {
      repo.findById.mockResolvedValue(
        ok(
          createFakeSdConfigItem({
            id: 'ci1',
            typeId: 't1',
            attributes: { hostname: 'srv', legacy: 'x' },
          }),
        ),
      )
      repo.update.mockResolvedValue(ok(createFakeSdConfigItem({ id: 'ci1' })))
    })

    it('prevents cycles: itself or a descendant as parent', async () => {
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', {
          parentId: 'ci1',
        }),
        'SD_CONFIG_ITEM_CYCLE',
      )
      repo.listChain.mockResolvedValueOnce(
        ok([
          { id: 'grandchild', name: 'G', code: null, parentId: 'ci1' },
          { id: 'ci1', name: 'Self', code: null, parentId: null },
        ]),
      )
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', {
          parentId: 'grandchild',
        }),
        'SD_CONFIG_ITEM_CYCLE',
      )
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('does not touch attributes when neither they nor the type change', async () => {
      expectOk(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', {
          name: 'Novo',
          typeId: 't1',
        }),
      )
      expect(types.findById).not.toHaveBeenCalled()
      expect(repo.update).toHaveBeenCalledWith(
        'ci1',
        expect.objectContaining({ name: 'Novo', attributes: undefined }),
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', targetId: 'ci1' }),
      )
    })

    it('validates sent attributes against the current type', async () => {
      expectOk(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', {
          attributes: { hostname: 'novo' },
        }),
      )
      expect(types.findById).toHaveBeenCalledWith('t1', 'ws1')
      expect(repo.update).toHaveBeenCalledWith(
        'ci1',
        expect.objectContaining({ attributes: { hostname: 'novo' } }),
      )
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', {
          attributes: { nope: 1 },
        }),
        'VALIDATION_ERROR',
      )
    })

    it('re-validates stored attributes on type change, dropping unknown keys', async () => {
      types.findById.mockResolvedValue(
        ok(
          createFakeSdConfigItemType({
            id: 't2',
            attributeSchema: [{ key: 'hostname', label: 'Host', type: 'text' }],
          }),
        ),
      )
      expectOk(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', { typeId: 't2' }),
      )
      expect(repo.update).toHaveBeenCalledWith(
        'ci1',
        expect.objectContaining({
          typeId: 't2',
          attributes: { hostname: 'srv' },
        }),
      )

      types.findById.mockResolvedValue(
        ok(
          createFakeSdConfigItemType({
            id: 't3',
            attributeSchema: [
              { key: 'serial', label: 'Série', type: 'text', required: true },
            ],
          }),
        ),
      )
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', { typeId: 't3' }),
        'VALIDATION_ERROR',
      )
    })

    it('clearing the type keeps attributes untouched', async () => {
      expectOk(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', { typeId: null }),
      )
      expect(repo.update).toHaveBeenCalledWith(
        'ci1',
        expect.objectContaining({ typeId: null, attributes: undefined }),
      )
    })

    it('handles non-object stored attributes on type change', async () => {
      repo.findById.mockResolvedValue(
        ok(createFakeSdConfigItem({ id: 'ci1', typeId: null, attributes: [] })),
      )
      types.findById.mockResolvedValue(
        ok(createFakeSdConfigItemType({ attributeSchema: [] })),
      )
      expectOk(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', { typeId: 't9' }),
      )
      expect(repo.update).toHaveBeenCalledWith(
        'ci1',
        expect.objectContaining({ attributes: {} }),
      )
    })

    it('propagates not found, reference and update errors', async () => {
      repo.findById.mockResolvedValueOnce(err(sdConfigItemNotFound()))
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', { name: 'x' }),
        'SD_CONFIG_ITEM_NOT_FOUND',
      )
      repo.departmentExists.mockResolvedValueOnce(ok(false))
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', {
          departmentId: 'dx',
        }),
        'SD_DEPARTMENT_NOT_FOUND',
      )
      repo.update.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdConfigItemService.update('u1', 'ws1', 'ci1', { name: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('soft-deletes re-parenting children to the item parent', async () => {
      asSdMember('ADMIN')
      repo.findById.mockResolvedValue(
        ok(createFakeSdConfigItem({ id: 'ci1', parentId: 'p1' })),
      )
      repo.softDelete.mockResolvedValueOnce(ok(undefined))
      expectOk(await SdConfigItemService.remove('u1', 'ws1', 'ci1'))
      expect(repo.softDelete).toHaveBeenCalledWith('ci1', 'p1')
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'sd_config_item', action: 'delete' }),
      )

      repo.softDelete.mockResolvedValueOnce(err(databaseError()))
      expectErr(
        await SdConfigItemService.remove('u1', 'ws1', 'ci1'),
        'DATABASE_ERROR',
      )
      repo.findById.mockResolvedValueOnce(err(sdConfigItemNotFound()))
      expectErr(
        await SdConfigItemService.remove('u1', 'ws1', 'ci1'),
        'SD_CONFIG_ITEM_NOT_FOUND',
      )
    })
  })
})
