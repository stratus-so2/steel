import type { Prisma } from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import {
  seedWhiteboard,
  seedWhiteboardVersion,
} from '@/src/__tests__/factories/whiteboard.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhiteboardVersionRepository } from '../whiteboard-version.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

const emptyScene = {
  elements: [],
  appState: {},
  files: {},
} as Prisma.InputJsonValue

async function fixture(
  boardOverrides?: Partial<Prisma.WhiteboardUncheckedCreateInput>,
) {
  const workspace = await seedWorkspace()
  const user = await seedUser({ name: 'Ana' })
  const board = await seedWhiteboard(workspace.id, user.id, boardOverrides)
  return { workspace, user, board }
}

describe('WhiteboardVersionRepository', () => {
  describe('listByBoard()', () => {
    it('lists the board versions newest first, without the scene', async () => {
      const { user, board } = await fixture()
      await seedWhiteboardVersion(board.id, user.id, {
        name: 'velha',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
      await seedWhiteboardVersion(board.id, user.id, {
        name: 'nova',
        kind: 'MANUAL',
        createdAt: new Date('2026-02-01T00:00:00Z'),
      })

      const versions = expectOk(
        await WhiteboardVersionRepository.listByBoard(board.id),
      )

      expect(versions.map((v) => v.name)).toEqual(['nova', 'velha'])
      expect(versions[0]).not.toHaveProperty('scene')
      expect(versions[0].createdBy?.name).toBe('Ana')
    })

    it('returns DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whiteboardVersion, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhiteboardVersionRepository.listByBoard('x'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('returns the version with its scene', async () => {
      const { user, board } = await fixture()
      const seeded = await seedWhiteboardVersion(board.id, user.id)

      const version = expectOk(
        await WhiteboardVersionRepository.findById(seeded.id),
      )
      expect(version.scene).toEqual(seeded.scene)
    })

    it('returns WHITEBOARD_VERSION_NOT_FOUND / DATABASE_ERROR', async () => {
      expectErr(
        await WhiteboardVersionRepository.findById('missing'),
        'WHITEBOARD_VERSION_NOT_FOUND',
      )
      vi.spyOn(prisma.whiteboardVersion, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhiteboardVersionRepository.findById('x'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('creates a version and moves the board version cursor', async () => {
      const { user, board } = await fixture({ revision: 4 })

      const version = expectOk(
        await WhiteboardVersionRepository.create(
          board.id,
          {
            kind: 'MANUAL',
            name: 'Entrega',
            scene: emptyScene,
            revision: 4,
            elementCount: 0,
            createdById: user.id,
          },
          50,
        ),
      )

      expect(version.name).toBe('Entrega')
      const row = await prisma.whiteboard.findUniqueOrThrow({
        where: { id: board.id },
      })
      expect(row.versionedRevision).toBe(4)
      expect(row.lastVersionAt).toEqual(version.createdAt)
    })

    it('keeps only the newest AUTO versions and never prunes MANUAL ones', async () => {
      const { user, board } = await fixture()
      await seedWhiteboardVersion(board.id, user.id, {
        kind: 'MANUAL',
        name: 'nomeada',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
      for (const day of [2, 3]) {
        await seedWhiteboardVersion(board.id, user.id, {
          kind: 'AUTO',
          createdAt: new Date(`2026-01-0${day}T00:00:00Z`),
        })
      }

      expectOk(
        await WhiteboardVersionRepository.create(
          board.id,
          {
            kind: 'AUTO',
            scene: emptyScene,
            revision: 9,
            elementCount: 0,
            createdById: user.id,
          },
          2,
        ),
      )

      const rows = await prisma.whiteboardVersion.findMany({
        where: { whiteboardId: board.id },
        orderBy: { createdAt: 'asc' },
      })
      expect(rows.map((r) => r.kind)).toEqual(['MANUAL', 'AUTO', 'AUTO'])
      expect(rows[1].createdAt).toEqual(new Date('2026-01-03T00:00:00Z'))
    })

    it('returns DATABASE_ERROR for an unknown board', async () => {
      const { user } = await fixture()
      expectErr(
        await WhiteboardVersionRepository.create(
          'missing',
          {
            kind: 'AUTO',
            scene: emptyScene,
            revision: 1,
            elementCount: 0,
            createdById: user.id,
          },
          50,
        ),
        'DATABASE_ERROR',
      )
    })
  })

  describe('restore()', () => {
    it('snapshots unversioned edits, puts the old scene back and records a RESTORE version', async () => {
      const { user, board } = await fixture({
        revision: 5,
        versionedRevision: 3,
      })
      const old = await seedWhiteboardVersion(board.id, user.id, {
        kind: 'MANUAL',
        name: 'v1',
        scene: emptyScene,
        elementCount: 0,
      })
      const now = new Date('2026-10-09T12:00:00Z')

      const restored = expectOk(
        await WhiteboardVersionRepository.restore(board, old, {
          actorId: user.id,
          now,
          keepAuto: 50,
          currentElementCount: 2,
        }),
      )

      expect(restored.revision).toBe(6)
      expect(restored.scene).toEqual(emptyScene)
      expect(restored.versionedRevision).toBe(6)
      expect(restored.editedAt).toEqual(now)

      const versions = await prisma.whiteboardVersion.findMany({
        where: { whiteboardId: board.id },
        orderBy: { createdAt: 'asc' },
      })
      expect(versions.map((v) => [v.kind, v.revision])).toEqual([
        ['MANUAL', 1],
        ['AUTO', 5],
        ['RESTORE', 6],
      ])
      expect(versions[1].scene).toEqual(board.scene)
      expect(versions[2].restoredFromId).toBe(old.id)
      expect(versions[2].name).toBe('v1')
    })

    it('skips the safety snapshot when the board has no unversioned edits', async () => {
      const { user, board } = await fixture({
        revision: 2,
        versionedRevision: 2,
      })
      const old = await seedWhiteboardVersion(board.id, user.id)

      expectOk(
        await WhiteboardVersionRepository.restore(board, old, {
          actorId: user.id,
          now: new Date(),
          keepAuto: 50,
          currentElementCount: 2,
        }),
      )

      expect(
        await prisma.whiteboardVersion.count({
          where: { whiteboardId: board.id },
        }),
      ).toBe(2)
    })

    it('rolls back with WHITEBOARD_REVISION_CONFLICT when the board moved', async () => {
      const { user, board } = await fixture({
        revision: 5,
        versionedRevision: 3,
      })
      const old = await seedWhiteboardVersion(board.id, user.id)

      const result = await WhiteboardVersionRepository.restore(
        { ...board, revision: 4 },
        old,
        {
          actorId: user.id,
          now: new Date(),
          keepAuto: 50,
          currentElementCount: 2,
        },
      )

      expectErr(result, 'WHITEBOARD_REVISION_CONFLICT')
      expect(
        await prisma.whiteboardVersion.count({
          where: { whiteboardId: board.id },
        }),
      ).toBe(1)
    })

    it('returns DATABASE_ERROR when the transaction throws', async () => {
      const { user, board } = await fixture()
      const old = await seedWhiteboardVersion(board.id, user.id)
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('boom'))

      expectErr(
        await WhiteboardVersionRepository.restore(board, old, {
          actorId: user.id,
          now: new Date(),
          keepAuto: 50,
          currentElementCount: 2,
        }),
        'DATABASE_ERROR',
      )
    })
  })
})
