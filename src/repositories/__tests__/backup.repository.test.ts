import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { BackupRepository } from '../backup.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BackupRepository', () => {
  describe('list()', () => {
    it('should filter by scope and workspace, newest first, limited', async () => {
      await prisma.backup.createMany({
        data: [
          { id: 'full-old', scope: 'FULL', startedAt: new Date('2026-01-01') },
          { id: 'full-new', scope: 'FULL', startedAt: new Date('2026-02-01') },
          {
            id: 'ws-a',
            scope: 'WORKSPACE',
            workspaceId: 'a',
            startedAt: new Date('2026-03-01'),
          },
          {
            id: 'ws-b',
            scope: 'WORKSPACE',
            workspaceId: 'b',
            startedAt: new Date('2026-04-01'),
          },
        ],
      })

      expect(
        expectOk(await BackupRepository.list({ limit: 10 })).map((b) => b.id),
      ).toEqual(['ws-b', 'ws-a', 'full-new', 'full-old'])
      expect(
        expectOk(await BackupRepository.list({ scope: 'FULL', limit: 1 })).map(
          (b) => b.id,
        ),
      ).toEqual(['full-new'])
      expect(
        expectOk(
          await BackupRepository.list({ workspaceId: 'a', limit: 10 }),
        ).map((b) => b.id),
      ).toEqual(['ws-a'])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.backup, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await BackupRepository.list({ limit: 1 }), 'DATABASE_ERROR')
    })
  })

  describe('findById()', () => {
    it('should return the backup or null', async () => {
      await prisma.backup.create({ data: { id: 'b1', scope: 'FULL' } })

      expect(expectOk(await BackupRepository.findById('b1'))?.scope).toBe(
        'FULL',
      )
      expect(expectOk(await BackupRepository.findById('missing'))).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.backup, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await BackupRepository.findById('b1'), 'DATABASE_ERROR')
    })
  })

  describe('existingWorkspaceIds()', () => {
    it('should short-circuit on an empty list without querying', async () => {
      const spy = vi.spyOn(prisma.workspace, 'findMany')
      expect(expectOk(await BackupRepository.existingWorkspaceIds([]))).toEqual(
        new Set(),
      )
      expect(spy).not.toHaveBeenCalled()
    })

    it('should return only the ids of workspaces that still exist', async () => {
      const workspace = await seedWorkspace()
      expect(
        expectOk(
          await BackupRepository.existingWorkspaceIds([workspace.id, 'gone']),
        ),
      ).toEqual(new Set([workspace.id]))
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.workspace, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await BackupRepository.existingWorkspaceIds(['x']),
        'DATABASE_ERROR',
      )
    })
  })
})
