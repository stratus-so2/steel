import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedCrmHookVaultItem } from '@/src/__tests__/factories/crm-hook-vault.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmHookVaultRepository } from '../crm-hook-vault.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CrmHookVaultRepository', () => {
  describe('create() / update() / findById()', () => {
    it('should create, update and find an item scoped to its workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])

      const created = expectOk(
        await CrmHookVaultRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          text: 'Você sabia que...',
          platform: 'INSTAGRAM',
          notes: 'gancho de curiosidade',
        }),
      )
      expect(created).toMatchObject({
        text: 'Você sabia que...',
        platform: 'INSTAGRAM',
        usageCount: 0,
      })

      const updated = expectOk(
        await CrmHookVaultRepository.update(created.id, {
          updatedById: user.id,
          text: 'Pare de rolar!',
          platform: null,
          usageCount: 3,
          notes: null,
        }),
      )
      expect(updated).toMatchObject({
        text: 'Pare de rolar!',
        platform: null,
        usageCount: 3,
        notes: null,
        updatedById: user.id,
      })

      expect(
        expectOk(
          await CrmHookVaultRepository.findById(created.id, workspace.id),
        ).text,
      ).toBe('Pare de rolar!')
      expectErr(
        await CrmHookVaultRepository.findById(created.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmHookVaultRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          text: 'x',
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when updating or deleting a missing item', async () => {
      expectErr(
        await CrmHookVaultRepository.update('missing', { updatedById: 'u' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmHookVaultRepository.softDelete('missing', 'u'),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when reads throw', async () => {
      vi.spyOn(prisma.crmHookVaultItem, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      vi.spyOn(prisma.crmHookVaultItem, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmHookVaultRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmHookVaultRepository.findById('i', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted items', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmHookVaultItem(workspace.id, user.id)
      await seedCrmHookVaultItem(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmHookVaultRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((i) => i.id)).toEqual([kept.id])
    })
  })

  describe('reorder()', () => {
    it('should update positions across the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmHookVaultItem(workspace.id, user.id)
      const b = await seedCrmHookVaultItem(workspace.id, user.id)

      expectOk(await CrmHookVaultRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmHookVaultRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((i) => i.id)).toEqual([b.id, a.id])
    })
  })

  describe('reorder() isolation', () => {
    it('should ignore ids from another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmHookVaultItem(other.id, user.id)

      expectOk(await CrmHookVaultRepository.reorder(workspace.id, [foreign.id]))

      const stored = await prisma.crmHookVaultItem.findUniqueOrThrow({
        where: { id: foreign.id },
      })
      expect(stored.position).toBe(foreign.position)
    })

    it('should return DATABASE_ERROR when the transaction throws', async () => {
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await CrmHookVaultRepository.reorder('w', ['a']),
        'DATABASE_ERROR',
      )
    })
  })

  describe('softDelete()', () => {
    it('should stamp deletedAt and updatedById', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const item = await seedCrmHookVaultItem(workspace.id, user.id)

      expectOk(await CrmHookVaultRepository.softDelete(item.id, user.id))

      const found = await CrmHookVaultRepository.findById(item.id, workspace.id)
      expect(found.ok).toBe(false)
    })
  })
})
