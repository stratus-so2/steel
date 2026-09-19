import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { ModuleUsageRepository } from '../module-usage.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ModuleUsageRepository', () => {
  describe('upsertDay()', () => {
    it('should write absolute counts, idempotently', async () => {
      const workspace = await seedWorkspace()
      const counters = [
        {
          workspaceId: workspace.id,
          module: 'CRM' as const,
          requests: 5,
          mutations: 2,
        },
      ]

      expect(
        expectOk(await ModuleUsageRepository.upsertDay('2026-09-18', counters)),
      ).toBe(1)
      // mesmo dia de novo, com o total do Redis já maior
      expectOk(
        await ModuleUsageRepository.upsertDay('2026-09-18', [
          { ...counters[0], requests: 8 },
        ]),
      )

      const rows = await prisma.moduleUsageDaily.findMany({
        where: { workspaceId: workspace.id },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].requests).toBe(8)
      expect(rows[0].mutations).toBe(2)
    })

    it('should drop counters of workspaces that no longer exist', async () => {
      const workspace = await seedWorkspace()
      const written = expectOk(
        await ModuleUsageRepository.upsertDay('2026-09-18', [
          {
            workspaceId: workspace.id,
            module: 'COMMUNICATION',
            requests: 1,
            mutations: 0,
          },
          {
            workspaceId: 'deleted-workspace',
            module: 'CRM',
            requests: 1,
            mutations: 0,
          },
        ]),
      )
      expect(written).toBe(1)
    })

    it('should return DATABASE_ERROR when the lookup of workspaces throws', async () => {
      vi.spyOn(prisma.workspace, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await ModuleUsageRepository.upsertDay('2026-09-18', [
          { workspaceId: 'w', module: 'CRM', requests: 1, mutations: 0 },
        ]),
        'DATABASE_ERROR',
      )
    })

    it('should return 0 without touching the database for no counters', async () => {
      const spy = vi.spyOn(prisma.workspace, 'findMany')
      expect(
        expectOk(await ModuleUsageRepository.upsertDay('2026-09-18', [])),
      ).toBe(0)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('listSince() / firstDay()', () => {
    it('should list rows from the given day with workspace info', async () => {
      const workspace = await seedWorkspace({
        name: 'Acme',
        slug: 'acme-usage',
      })
      await ModuleUsageRepository.upsertDay('2026-09-10', [
        { workspaceId: workspace.id, module: 'CRM', requests: 1, mutations: 0 },
      ])
      await ModuleUsageRepository.upsertDay('2026-09-17', [
        { workspaceId: workspace.id, module: 'CRM', requests: 4, mutations: 1 },
      ])

      const rows = expectOk(await ModuleUsageRepository.listSince('2026-09-15'))
      expect(rows).toEqual([
        {
          day: '2026-09-17',
          workspaceId: workspace.id,
          workspaceName: 'Acme',
          workspaceSlug: 'acme-usage',
          module: 'CRM',
          requests: 4,
          mutations: 1,
        },
      ])
      expect(expectOk(await ModuleUsageRepository.firstDay())).toBe(
        '2026-09-10',
      )
    })

    it('should return null as first day when nothing was tracked', async () => {
      expect(expectOk(await ModuleUsageRepository.firstDay())).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.moduleUsageDaily, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await ModuleUsageRepository.listSince('2026-09-01'),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('ModuleUsageRepository — database failures', () => {
  it('should return DATABASE_ERROR when reads throw', async () => {
    vi.spyOn(prisma.moduleUsageDaily, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.moduleUsageDaily, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )

    expectErr(
      await ModuleUsageRepository.listSince('2026-01-01'),
      'DATABASE_ERROR',
    )
    expectErr(await ModuleUsageRepository.firstDay(), 'DATABASE_ERROR')
  })
})
