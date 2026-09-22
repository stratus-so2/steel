import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  seedSdConfigItem,
  seedSdConfigItemType,
} from '@/src/__tests__/factories/sd-config-item.factory'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { ListSdConfigItemsSchema } from '@/src/schemas/sd-config-item.schema'
import {
  SD_CI_MAX_DEPTH,
  SdConfigItemRepository,
} from '../sd-config-item.repository'
import { SdConfigItemTypeRepository } from '../sd-config-item-type.repository'

const list = (input: Record<string, unknown> = {}) =>
  ListSdConfigItemsSchema.parse(input)

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('SdConfigItemTypeRepository', () => {
  it('lists by position with live item counts, finds, updates and deletes', async () => {
    const { workspace, other, user } = await setup()
    const created = expectOk(
      await SdConfigItemTypeRepository.create({
        workspaceId: workspace.id,
        name: 'Servidor',
        attributeSchema: [{ key: 'os', label: 'SO', type: 'text' }],
      }),
    )
    expect(created.position).toBe(0)
    const second = expectOk(
      await SdConfigItemTypeRepository.create({
        workspaceId: workspace.id,
        name: 'Notebook',
      }),
    )
    expect(second.position).toBe(1)
    const pinned = expectOk(
      await SdConfigItemTypeRepository.create({
        workspaceId: workspace.id,
        name: 'Link',
        position: 0,
      }),
    )
    await seedSdConfigItem(workspace.id, user.id, { typeId: created.id })
    await seedSdConfigItem(workspace.id, user.id, {
      typeId: created.id,
      deletedAt: new Date(),
    })
    await seedSdConfigItemType(other.id, { name: 'Servidor' })

    const types = expectOk(await SdConfigItemTypeRepository.list(workspace.id))
    expect(types.map((t) => t.name)).toEqual(['Link', 'Servidor', 'Notebook'])
    expect(types[1]._count.items).toBe(1)
    expect(pinned.position).toBe(0)

    expectErr(
      await SdConfigItemTypeRepository.findById(created.id, other.id),
      'SD_CONFIG_ITEM_TYPE_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdConfigItemTypeRepository.findById(created.id, workspace.id),
      )._count.items,
    ).toBe(1)

    expect(
      expectOk(
        await SdConfigItemTypeRepository.nameTaken(workspace.id, 'servidor'),
      ),
    ).toBe(true)
    expect(
      expectOk(
        await SdConfigItemTypeRepository.nameTaken(
          workspace.id,
          'SERVIDOR',
          created.id,
        ),
      ),
    ).toBe(false)

    const updated = expectOk(
      await SdConfigItemTypeRepository.update(created.id, { color: '#000000' }),
    )
    expect(updated.color).toBe('#000000')

    expectOk(await SdConfigItemTypeRepository.delete(created.id))
    const orphan = await prisma.sdConfigItem.findFirstOrThrow({
      where: { workspaceId: workspace.id, deletedAt: null },
    })
    expect(orphan.typeId).toBeNull()
  })

  it('returns DATABASE_ERROR on failures', async () => {
    expectErr(
      await SdConfigItemTypeRepository.create({
        workspaceId: 'missing',
        name: 'X',
        position: 0,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdConfigItemTypeRepository.update('missing', { name: 'X' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdConfigItemTypeRepository.delete('missing'),
      'DATABASE_ERROR',
    )

    const boom = () => Promise.reject(new Error('boom'))
    vi.spyOn(prisma.sdConfigItemType, 'findMany').mockImplementation(
      boom as never,
    )
    vi.spyOn(prisma.sdConfigItemType, 'findFirst').mockImplementation(
      boom as never,
    )
    expectErr(await SdConfigItemTypeRepository.list('ws'), 'DATABASE_ERROR')
    expectErr(
      await SdConfigItemTypeRepository.findById('x', 'ws'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdConfigItemTypeRepository.nameTaken('ws', 'x'),
      'DATABASE_ERROR',
    )
    vi.restoreAllMocks()
  })
})

describe('SdConfigItemRepository', () => {
  afterEach(() => vi.restoreAllMocks())

  describe('list()', () => {
    it('filters by type/status/criticality/customer/department/parent and searches', async () => {
      const { workspace, other, user } = await setup()
      const type = await seedSdConfigItemType(workspace.id, {
        name: 'Servidor',
      })
      const customer = await seedSdCustomer(workspace.id, user.id)
      const department = await prisma.sdDepartment.create({
        data: { workspaceId: workspace.id, name: 'Infra' },
      })
      const root = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Rack A',
        typeId: type.id,
        customerId: customer.id,
        departmentId: department.id,
        criticality: 'HIGH',
        ipAddress: '10.0.0.1',
      })
      const child = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Switch',
        parentId: root.id,
        status: 'MAINTENANCE',
        serialNumber: 'SN-XYZ',
      })
      await seedSdConfigItem(workspace.id, user.id, {
        name: 'Excluído',
        deletedAt: new Date(),
        parentId: root.id,
      })
      await seedSdConfigItem(other.id, user.id, { name: 'Outro' })

      const all = expectOk(
        await SdConfigItemRepository.list(workspace.id, list()),
      )
      expect(all.total).toBe(2)
      expect(all.items.map((i) => i.name)).toEqual(['Rack A', 'Switch'])
      expect(all.items[0]._count.children).toBe(1)
      expect(all.items[0].type?.name).toBe('Servidor')
      expect(all.items[0].department?.name).toBe('Infra')

      const ids = async (input: Record<string, unknown>) =>
        expectOk(
          await SdConfigItemRepository.list(workspace.id, list(input)),
        ).items.map((i) => i.id)

      expect(await ids({ typeId: type.id })).toEqual([root.id])
      expect(await ids({ status: 'MAINTENANCE' })).toEqual([child.id])
      expect(await ids({ criticality: 'HIGH' })).toEqual([root.id])
      expect(await ids({ customerId: customer.id })).toEqual([root.id])
      expect(await ids({ departmentId: department.id })).toEqual([root.id])
      expect(await ids({ parentId: root.id })).toEqual([child.id])
      expect(await ids({ q: 'sn-xy' })).toEqual([child.id])
      expect(await ids({ q: '10.0.0' })).toEqual([root.id])
      expect(await ids({ sort: 'name', order: 'desc', pageSize: 1 })).toEqual([
        child.id,
      ])
    })

    it('filters by warranty expiring in N days, nulls last when sorting', async () => {
      const { workspace, user } = await setup()
      const now = new Date('2026-09-22T12:00:00')
      const soon = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Soon',
        warrantyUntil: new Date('2026-09-30T00:00:00'),
      })
      await seedSdConfigItem(workspace.id, user.id, {
        name: 'Later',
        warrantyUntil: new Date('2026-12-31T00:00:00'),
      })
      await seedSdConfigItem(workspace.id, user.id, {
        name: 'Expired',
        warrantyUntil: new Date('2026-09-01T00:00:00'),
      })
      await seedSdConfigItem(workspace.id, user.id, { name: 'None' })

      const expiring = expectOk(
        await SdConfigItemRepository.list(
          workspace.id,
          list({ warrantyExpiringInDays: '30' }),
          now,
        ),
      )
      expect(expiring.items.map((i) => i.id)).toEqual([soon.id])

      const sorted = expectOk(
        await SdConfigItemRepository.list(
          workspace.id,
          list({ sort: 'warrantyUntil', order: 'asc' }),
        ),
      )
      expect(sorted.items.map((i) => i.name)).toEqual([
        'Expired',
        'Soon',
        'Later',
        'None',
      ])
    })
  })

  describe('findById() / listChildren() / listChain()', () => {
    it('returns the tree around an item', async () => {
      const { workspace, other, user } = await setup()
      const root = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Root',
      })
      const mid = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Mid',
        parentId: root.id,
      })
      const leaf = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Leaf',
        parentId: mid.id,
      })

      expect(
        expectOk(await SdConfigItemRepository.findById(mid.id, workspace.id))
          .parent?.id,
      ).toBe(root.id)
      expectErr(
        await SdConfigItemRepository.findById(mid.id, other.id),
        'SD_CONFIG_ITEM_NOT_FOUND',
      )

      const children = expectOk(
        await SdConfigItemRepository.listChildren(workspace.id, root.id),
      )
      expect(children).toEqual([
        {
          id: mid.id,
          name: 'Mid',
          code: null,
          status: 'ACTIVE',
          type: null,
          _count: { children: 1 },
        },
      ])

      const chain = expectOk(
        await SdConfigItemRepository.listChain(workspace.id, leaf.id),
      )
      expect(chain.map((c) => c.name)).toEqual(['Leaf', 'Mid', 'Root'])
      expect(
        expectOk(await SdConfigItemRepository.listChain(other.id, leaf.id)),
      ).toEqual([])
    })

    it('stops on pre-existing cycles and at the max depth', async () => {
      const { workspace, user } = await setup()
      const a = await seedSdConfigItem(workspace.id, user.id, { name: 'A' })
      const b = await seedSdConfigItem(workspace.id, user.id, {
        name: 'B',
        parentId: a.id,
      })
      await prisma.sdConfigItem.update({
        where: { id: a.id },
        data: { parentId: b.id },
      })
      const chain = expectOk(
        await SdConfigItemRepository.listChain(workspace.id, a.id),
      )
      expect(chain.map((c) => c.name)).toEqual(['A', 'B'])

      let parentId: string | null = null
      for (let i = 0; i < SD_CI_MAX_DEPTH + 2; i++) {
        const node = await seedSdConfigItem(workspace.id, user.id, {
          name: `N${i}`,
          parentId,
        })
        parentId = node.id
      }
      const deep = expectOk(
        await SdConfigItemRepository.listChain(
          workspace.id,
          parentId as string,
        ),
      )
      expect(deep).toHaveLength(SD_CI_MAX_DEPTH)
    })
  })

  describe('listRecentTickets() / departmentExists() / options()', () => {
    it('reads linked tickets, departments and options', async () => {
      const { workspace, other, user } = await setup()
      const customer = await seedSdCustomer(workspace.id, user.id, {
        name: 'Acme',
      })
      const type = await seedSdConfigItemType(workspace.id, { name: 'Link' })
      const ci = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Link MPLS',
        code: 'LNK-1',
        customerId: customer.id,
        typeId: type.id,
      })
      await seedSdConfigItem(workspace.id, user.id, {
        name: 'Link antigo',
        status: 'RETIRED',
        customerId: customer.id,
      })
      const other1 = await seedSdConfigItem(workspace.id, user.id, {
        name: 'Link backup',
      })

      const phase = await prisma.sdPhase.create({
        data: {
          workspaceId: workspace.id,
          ticketType: 'INCIDENT',
          name: 'Novo',
          category: 'NEW',
        },
      })
      await prisma.sdTicket.create({
        data: {
          workspaceId: workspace.id,
          number: 1,
          type: 'INCIDENT',
          title: 'Link caiu',
          phaseId: phase.id,
          configItemId: ci.id,
        },
      })
      const tickets = expectOk(
        await SdConfigItemRepository.listRecentTickets(workspace.id, ci.id),
      )
      expect(tickets.map((t) => t.title)).toEqual(['Link caiu'])

      const dep = await prisma.sdDepartment.create({
        data: { workspaceId: workspace.id, name: 'NOC' },
      })
      const deletedDep = await prisma.sdDepartment.create({
        data: { workspaceId: workspace.id, name: 'Old', deletedAt: new Date() },
      })
      expect(
        expectOk(
          await SdConfigItemRepository.departmentExists(workspace.id, dep.id),
        ),
      ).toBe(true)
      expect(
        expectOk(
          await SdConfigItemRepository.departmentExists(other.id, dep.id),
        ),
      ).toBe(false)
      expect(
        expectOk(
          await SdConfigItemRepository.departmentExists(
            workspace.id,
            deletedDep.id,
          ),
        ),
      ).toBe(false)

      const byCustomer = expectOk(
        await SdConfigItemRepository.options(workspace.id, {
          q: 'link',
          customerId: customer.id,
          limit: 10,
        }),
      )
      expect(byCustomer).toEqual([
        {
          id: ci.id,
          name: 'Link MPLS',
          code: 'LNK-1',
          type: { name: 'Link' },
          customer: { name: 'Acme' },
        },
      ])
      const excluding = expectOk(
        await SdConfigItemRepository.options(workspace.id, {
          excludeId: ci.id,
          limit: 10,
        }),
      )
      expect(excluding.map((r) => r.id)).toEqual([other1.id])
    })
  })

  describe('create() / update() / softDelete()', () => {
    it('writes and re-parents children on delete', async () => {
      const { workspace, user } = await setup()
      const root = await seedSdConfigItem(workspace.id, user.id)
      const created = expectOk(
        await SdConfigItemRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Mid',
          parentId: root.id,
          attributes: { hostname: 'x' },
        }),
      )
      expect(created.attributes).toEqual({ hostname: 'x' })
      const leaf = await seedSdConfigItem(workspace.id, user.id, {
        parentId: created.id,
      })

      const updated = expectOk(
        await SdConfigItemRepository.update(created.id, {
          warrantyUntil: new Date('2027-01-01'),
        }),
      )
      expect(updated.warrantyUntil?.toISOString()).toContain('2027-01-01')

      expectOk(await SdConfigItemRepository.softDelete(created.id, root.id))
      const moved = await prisma.sdConfigItem.findUniqueOrThrow({
        where: { id: leaf.id },
      })
      expect(moved.parentId).toBe(root.id)
      expectErr(
        await SdConfigItemRepository.findById(created.id, workspace.id),
        'SD_CONFIG_ITEM_NOT_FOUND',
      )
    })

    it('returns DATABASE_ERROR on failures', async () => {
      const user = await seedUser()
      expectErr(
        await SdConfigItemRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          name: 'X',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.update('missing', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.softDelete('missing', null),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.list('ws', {
          ...list(),
          sort: 'nope' as never,
        }),
        'DATABASE_ERROR',
      )

      const boom = () => Promise.reject(new Error('boom'))
      vi.spyOn(prisma.sdConfigItem, 'findFirst').mockImplementation(
        boom as never,
      )
      vi.spyOn(prisma.sdConfigItem, 'findMany').mockImplementation(
        boom as never,
      )
      vi.spyOn(prisma.sdTicket, 'findMany').mockImplementation(boom as never)
      vi.spyOn(prisma.sdDepartment, 'findFirst').mockImplementation(
        boom as never,
      )
      expectErr(
        await SdConfigItemRepository.findById('x', 'ws'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.listChildren('ws', 'x'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.listChain('ws', 'x'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.listRecentTickets('ws', 'x'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.departmentExists('ws', 'x'),
        'DATABASE_ERROR',
      )
      expectErr(
        await SdConfigItemRepository.options('ws', { limit: 1 }),
        'DATABASE_ERROR',
      )
    })
  })
})
