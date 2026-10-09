import type { Prisma } from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import {
  fakeWhiteboardScene,
  seedWhiteboard,
} from '@/src/__tests__/factories/whiteboard.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  WhiteboardRepository,
  WhiteboardSettingsRepository,
} from '../whiteboard.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

const scene = fakeWhiteboardScene() as unknown as Prisma.InputJsonValue

async function fixture() {
  const workspace = await seedWorkspace()
  const user = await seedUser({ name: 'Ana' })
  const other = await seedUser({ name: 'Bruno' })
  return { workspace, user, other }
}

describe('WhiteboardRepository', () => {
  describe('findById()', () => {
    it('returns the board with its people', async () => {
      const { workspace, user } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id, {
        title: 'Retro',
      })

      const board = expectOk(await WhiteboardRepository.findById(seeded.id))

      expect(board.title).toBe('Retro')
      expect(board.createdBy).toEqual({ id: user.id, name: 'Ana' })
      expect(board.lockedBy).toBeNull()
    })

    it('returns WHITEBOARD_NOT_FOUND for an unknown id', async () => {
      expectErr(
        await WhiteboardRepository.findById('missing'),
        'WHITEBOARD_NOT_FOUND',
      )
    })

    it('returns DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whiteboard, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await WhiteboardRepository.findById('x'), 'DATABASE_ERROR')
    })
  })

  describe('listByWorkspace()', () => {
    it('lists live boards of the workspace, newest edit first, without the scene', async () => {
      const { workspace, user } = await fixture()
      const elsewhere = await seedWorkspace()
      await seedWhiteboard(workspace.id, user.id, {
        title: 'Antigo',
        editedAt: new Date('2026-01-01T00:00:00Z'),
      })
      await seedWhiteboard(workspace.id, user.id, {
        title: 'Recente',
        editedAt: new Date('2026-02-01T00:00:00Z'),
      })
      await seedWhiteboard(workspace.id, user.id, {
        title: 'Arquivado',
        archivedAt: new Date(),
      })
      await seedWhiteboard(elsewhere.id, user.id, { title: 'Outro' })

      const boards = expectOk(
        await WhiteboardRepository.listByWorkspace(workspace.id, {
          q: '',
          archived: false,
        }),
      )

      expect(boards.map((b) => b.title)).toEqual(['Recente', 'Antigo'])
      expect(boards[0]).not.toHaveProperty('scene')
    })

    it('lists only archived boards when asked and filters by title', async () => {
      const { workspace, user } = await fixture()
      await seedWhiteboard(workspace.id, user.id, {
        title: 'Plano de Sprint',
        archivedAt: new Date(),
      })
      await seedWhiteboard(workspace.id, user.id, {
        title: 'Roadmap',
        archivedAt: new Date(),
      })
      await seedWhiteboard(workspace.id, user.id, { title: 'Sprint vivo' })

      const boards = expectOk(
        await WhiteboardRepository.listByWorkspace(workspace.id, {
          q: 'sprint',
          archived: true,
        }),
      )

      expect(boards.map((b) => b.title)).toEqual(['Plano de Sprint'])
    })

    it('returns DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whiteboard, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhiteboardRepository.listByWorkspace('ws', {
          q: '',
          archived: false,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('creates a board at revision 0 authored and edited by the creator', async () => {
      const { workspace, user } = await fixture()

      const board = expectOk(
        await WhiteboardRepository.create({
          workspaceId: workspace.id,
          title: 'Novo',
          scene,
          createdById: user.id,
        }),
      )

      expect(board.revision).toBe(0)
      expect(board.updatedBy?.id).toBe(user.id)
      expect(board.scene).toEqual(scene)
    })

    it('returns DATABASE_ERROR for a missing workspace', async () => {
      const { user } = await fixture()
      expectErr(
        await WhiteboardRepository.create({
          workspaceId: 'missing',
          title: 'x',
          scene,
          createdById: user.id,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('rename()', () => {
    it('updates the title, editor and edit time', async () => {
      const { workspace, user, other } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id, {
        editedAt: new Date('2026-01-01T00:00:00Z'),
      })

      const board = expectOk(
        await WhiteboardRepository.rename(seeded.id, {
          title: 'Renomeado',
          updatedById: other.id,
        }),
      )

      expect(board.title).toBe('Renomeado')
      expect(board.updatedBy?.name).toBe('Bruno')
      expect(board.editedAt.getTime()).toBeGreaterThan(
        new Date('2026-01-01T00:00:00Z').getTime(),
      )
    })

    it('returns DATABASE_ERROR for an unknown id', async () => {
      expectErr(
        await WhiteboardRepository.rename('missing', {
          title: 'x',
          updatedById: 'u',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('saveScene()', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    const leaseUntil = new Date('2026-10-09T12:01:00Z')

    it('saves on the expected revision, bumps it and takes the lease', async () => {
      const { workspace, user } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id)
      const next = { elements: [], appState: {}, files: {} }

      const board = expectOk(
        await WhiteboardRepository.saveScene(seeded.id, {
          scene: next,
          baseRevision: 0,
          actorId: user.id,
          now,
          leaseUntil,
        }),
      )

      expect(board?.revision).toBe(1)
      expect(board?.scene).toEqual(next)
      expect(board?.lockedById).toBe(user.id)
      expect(board?.lockedUntil).toEqual(leaseUntil)
      expect(board?.editedAt).toEqual(now)
    })

    it('returns null on a stale revision', async () => {
      const { workspace, user } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id, {
        revision: 3,
      })

      const result = expectOk(
        await WhiteboardRepository.saveScene(seeded.id, {
          scene,
          baseRevision: 2,
          actorId: user.id,
          now,
          leaseUntil,
        }),
      )

      expect(result).toBeNull()
    })

    it('returns null while another member holds a live lease, and saves once it expires', async () => {
      const { workspace, user, other } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id, {
        lockedById: other.id,
        lockedUntil: new Date('2026-10-09T12:00:30Z'),
      })

      const blocked = expectOk(
        await WhiteboardRepository.saveScene(seeded.id, {
          scene,
          baseRevision: 0,
          actorId: user.id,
          now,
          leaseUntil,
        }),
      )
      expect(blocked).toBeNull()

      const later = new Date('2026-10-09T12:00:31Z')
      const saved = expectOk(
        await WhiteboardRepository.saveScene(seeded.id, {
          scene,
          baseRevision: 0,
          actorId: user.id,
          now: later,
          leaseUntil,
        }),
      )
      expect(saved?.lockedById).toBe(user.id)
    })

    it('returns DATABASE_ERROR when the update throws', async () => {
      vi.spyOn(prisma.whiteboard, 'updateMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhiteboardRepository.saveScene('x', {
          scene,
          baseRevision: 0,
          actorId: 'u',
          now,
          leaseUntil,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('acquireLock() / releaseLock()', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    const leaseUntil = new Date('2026-10-09T12:01:00Z')

    it('takes a free lease and keeps someone else’s live one', async () => {
      const { workspace, user, other } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id)

      const mine = expectOk(
        await WhiteboardRepository.acquireLock(seeded.id, {
          actorId: user.id,
          now,
          leaseUntil,
        }),
      )
      expect(mine.lockedById).toBe(user.id)
      expect(mine.lockedBy?.name).toBe('Ana')

      const theirs = expectOk(
        await WhiteboardRepository.acquireLock(seeded.id, {
          actorId: other.id,
          now,
          leaseUntil,
        }),
      )
      expect(theirs.lockedById).toBe(user.id)
    })

    it('releases only the holder’s lease', async () => {
      const { workspace, user, other } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id, {
        lockedById: user.id,
        lockedUntil: leaseUntil,
      })

      expect(
        expectOk(await WhiteboardRepository.releaseLock(seeded.id, other.id)),
      ).toBe(false)
      expect(
        expectOk(await WhiteboardRepository.releaseLock(seeded.id, user.id)),
      ).toBe(true)

      const row = await prisma.whiteboard.findUniqueOrThrow({
        where: { id: seeded.id },
      })
      expect(row.lockedById).toBeNull()
      expect(row.lockedUntil).toBeNull()
    })

    it('returns DATABASE_ERROR when the queries throw', async () => {
      vi.spyOn(prisma.whiteboard, 'updateMany').mockRejectedValue(
        new Error('boom'),
      )
      expectErr(
        await WhiteboardRepository.acquireLock('x', {
          actorId: 'u',
          now,
          leaseUntil,
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhiteboardRepository.releaseLock('x', 'u'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('setArchived()', () => {
    it('archives (dropping the lease) and unarchives', async () => {
      const { workspace, user } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id, {
        lockedById: user.id,
        lockedUntil: new Date(Date.now() + 60_000),
      })

      const archived = expectOk(
        await WhiteboardRepository.setArchived(seeded.id, {
          archivedAt: new Date(),
          updatedById: user.id,
        }),
      )
      expect(archived.archivedAt).not.toBeNull()
      expect(archived.lockedById).toBeNull()

      const restored = expectOk(
        await WhiteboardRepository.setArchived(seeded.id, {
          archivedAt: null,
          updatedById: user.id,
        }),
      )
      expect(restored.archivedAt).toBeNull()
    })

    it('returns DATABASE_ERROR for an unknown id', async () => {
      expectErr(
        await WhiteboardRepository.setArchived('missing', {
          archivedAt: null,
          updatedById: 'u',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('setThumbnailAt()', () => {
    it('stores the thumbnail time', async () => {
      const { workspace, user } = await fixture()
      const seeded = await seedWhiteboard(workspace.id, user.id)
      const at = new Date('2026-10-09T12:00:00Z')

      expect(
        expectOk(await WhiteboardRepository.setThumbnailAt(seeded.id, at)),
      ).toEqual(at)
    })

    it('returns DATABASE_ERROR for an unknown id', async () => {
      expectErr(
        await WhiteboardRepository.setThumbnailAt('missing', new Date()),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('WhiteboardSettingsRepository', () => {
  it('starts on and flips the workspace switch', async () => {
    const workspace = await seedWorkspace()

    expect(
      expectOk(await WhiteboardSettingsRepository.isEnabled(workspace.id)),
    ).toBe(true)
    expect(
      expectOk(
        await WhiteboardSettingsRepository.setEnabled(workspace.id, false),
      ),
    ).toBe(false)
    expect(
      expectOk(await WhiteboardSettingsRepository.isEnabled(workspace.id)),
    ).toBe(false)
  })

  it('returns RESOURCE_NOT_FOUND for an unknown workspace', async () => {
    expectErr(
      await WhiteboardSettingsRepository.isEnabled('missing'),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('returns DATABASE_ERROR when the queries throw', async () => {
    vi.spyOn(prisma.workspace, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await WhiteboardSettingsRepository.isEnabled('x'),
      'DATABASE_ERROR',
    )
    expectErr(
      await WhiteboardSettingsRepository.setEnabled('missing', true),
      'DATABASE_ERROR',
    )
  })
})
