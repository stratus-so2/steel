import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import {
  createFakeWhiteboard,
  createFakeWhiteboardVersion,
} from '@/src/__tests__/factories/whiteboard.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { indexSearchDocument } from '@/src/lib/search/index-hooks'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  WhiteboardRepository,
  WhiteboardSettingsRepository,
} from '@/src/repositories/whiteboard.repository'
import { WhiteboardVersionRepository } from '@/src/repositories/whiteboard-version.repository'
import {
  WHITEBOARD_AUTO_VERSION_INTERVAL_MS,
  WHITEBOARD_AUTO_VERSION_REVISIONS,
  WHITEBOARD_AUTO_VERSIONS_KEPT,
  WhiteboardService,
} from '../whiteboard.service'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whiteboard.repository')
vi.mock('@/src/repositories/whiteboard-version.repository')
vi.mock('@/src/lib/search/index-hooks', () => ({
  indexSearchDocument: vi.fn(async () => undefined),
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const memberships = vi.mocked(MembershipRepository)
const boards = vi.mocked(WhiteboardRepository)
const settings = vi.mocked(WhiteboardSettingsRepository)
const versions = vi.mocked(WhiteboardVersionRepository)
const index = vi.mocked(indexSearchDocument)

const WS = 'ws1'
const ACTOR = 'actor'
const scene = { elements: [], appState: {}, files: {} }

function as(role: Role) {
  memberships.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: ACTOR, workspaceId: WS, role })),
  )
}

function board(overrides: Parameters<typeof createFakeWhiteboard>[0] = {}) {
  return createFakeWhiteboard({ id: 'b1', workspaceId: WS, ...overrides })
}

beforeEach(() => {
  vi.clearAllMocks()
  as('MEMBER')
  settings.isEnabled.mockResolvedValue(ok(true))
  boards.findById.mockResolvedValue(ok(board()))
})

describe('access gate', () => {
  it('denies a non-member before reading the switch', async () => {
    memberships.findByUserAndWorkspace.mockResolvedValue(ok(null))

    expectErr(
      await WhiteboardService.list(ACTOR, WS, { q: '', archived: false }),
      'FORBIDDEN',
    )
    expect(settings.isEnabled).not.toHaveBeenCalled()
  })

  it('answers WHITEBOARD_DISABLED while the workspace switch is off', async () => {
    settings.isEnabled.mockResolvedValue(ok(false))

    expectErr(
      await WhiteboardService.list(ACTOR, WS, { q: '', archived: false }),
      'WHITEBOARD_DISABLED',
    )
  })

  it('propagates a settings read error', async () => {
    settings.isEnabled.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.getById(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
  })

  it('checks the switch before the role on writes', async () => {
    settings.isEnabled.mockResolvedValue(ok(false))
    expectErr(
      await WhiteboardService.create(ACTOR, WS, { title: 'x' }),
      'WHITEBOARD_DISABLED',
    )
  })

  it('keeps VIEWERs read-only', async () => {
    as('VIEWER')
    expectErr(
      await WhiteboardService.create(ACTOR, WS, { title: 'x' }),
      'WHITEBOARD_FORBIDDEN',
    )
    expect(boards.create).not.toHaveBeenCalled()
  })

  it('hides a board of another workspace', async () => {
    boards.findById.mockResolvedValue(ok(board({ workspaceId: 'other' })))
    expectErr(
      await WhiteboardService.getById(ACTOR, WS, 'b1'),
      'WHITEBOARD_FORBIDDEN',
    )
  })

  it('propagates a board read error', async () => {
    boards.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.getById(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
  })
})

describe('list() / getById()', () => {
  it('lists summaries with the filter', async () => {
    boards.listByWorkspace.mockResolvedValue(ok([board()]))

    const list = expectOk(
      await WhiteboardService.list(ACTOR, WS, { q: 'retro', archived: true }),
    )

    expect(list).toHaveLength(1)
    expect(list[0]).not.toHaveProperty('scene')
    expect(boards.listByWorkspace).toHaveBeenCalledWith(WS, {
      q: 'retro',
      archived: true,
    })
  })

  it('propagates a list error', async () => {
    boards.listByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.list(ACTOR, WS, { q: '', archived: false }),
      'DATABASE_ERROR',
    )
  })

  it('lets a VIEWER open a board with its scene', async () => {
    as('VIEWER')
    const dto = expectOk(await WhiteboardService.getById(ACTOR, WS, 'b1'))
    expect(dto.scene.elements).toHaveLength(2)
  })
})

describe('create()', () => {
  it('creates an empty board and indexes it', async () => {
    boards.create.mockResolvedValue(ok(board({ title: 'Retro' })))

    const dto = expectOk(
      await WhiteboardService.create(ACTOR, WS, { title: 'Retro' }),
    )

    expect(dto.title).toBe('Retro')
    expect(boards.create).toHaveBeenCalledWith({
      workspaceId: WS,
      title: 'Retro',
      scene,
      createdById: ACTOR,
    })
    expect(index).toHaveBeenCalledWith('whiteboard', WS, 'b1')
  })

  it('propagates a create error without indexing', async () => {
    boards.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.create(ACTOR, WS, { title: '' }),
      'DATABASE_ERROR',
    )
    expect(index).not.toHaveBeenCalled()
  })
})

describe('rename()', () => {
  it('renames and reindexes', async () => {
    boards.rename.mockResolvedValue(ok(board({ title: 'Novo' })))

    const dto = expectOk(
      await WhiteboardService.rename(ACTOR, WS, 'b1', { title: 'Novo' }),
    )

    expect(dto.title).toBe('Novo')
    expect(boards.rename).toHaveBeenCalledWith('b1', {
      title: 'Novo',
      updatedById: ACTOR,
    })
  })

  it('stops on a missing board or a rename error', async () => {
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardService.rename(ACTOR, WS, 'b1', { title: 'x' }),
      'DATABASE_ERROR',
    )
    boards.rename.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.rename(ACTOR, WS, 'b1', { title: 'x' }),
      'DATABASE_ERROR',
    )
  })

  it('denies VIEWERs', async () => {
    as('VIEWER')
    expectErr(
      await WhiteboardService.rename(ACTOR, WS, 'b1', { title: 'x' }),
      'WHITEBOARD_FORBIDDEN',
    )
  })
})

describe('duplicate()', () => {
  it('copies the scene under a "(cópia)" title', async () => {
    boards.findById.mockResolvedValue(ok(board({ title: 'Retro' })))
    boards.create.mockResolvedValue(ok(board({ id: 'b2' })))

    expectOk(await WhiteboardService.duplicate(ACTOR, WS, 'b1'))

    expect(boards.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Retro (cópia)',
        createdById: ACTOR,
        scene: expect.objectContaining({ elements: expect.any(Array) }),
      }),
    )
    expect(index).toHaveBeenCalledWith('whiteboard', WS, 'b2')
  })

  it('names an untitled copy and keeps long titles within the limit', async () => {
    boards.findById.mockResolvedValueOnce(ok(board({ title: '' })))
    boards.create.mockResolvedValue(ok(board()))
    expectOk(await WhiteboardService.duplicate(ACTOR, WS, 'b1'))
    expect(boards.create.mock.calls[0][0].title).toBe(
      'Quadro sem título (cópia)',
    )

    boards.findById.mockResolvedValueOnce(ok(board({ title: 'x'.repeat(120) })))
    expectOk(await WhiteboardService.duplicate(ACTOR, WS, 'b1'))
    expect(boards.create.mock.calls[1][0].title).toHaveLength(120)
  })

  it('stops on a missing source or a create error', async () => {
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardService.duplicate(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
    boards.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.duplicate(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
  })

  it('denies VIEWERs', async () => {
    as('VIEWER')
    expectErr(
      await WhiteboardService.duplicate(ACTOR, WS, 'b1'),
      'WHITEBOARD_FORBIDDEN',
    )
  })
})

describe('setArchived()', () => {
  it('lets the creator archive and unarchive', async () => {
    boards.findById.mockResolvedValue(ok(board({ createdById: ACTOR })))
    boards.setArchived.mockResolvedValue(ok(board({ archivedAt: new Date() })))

    const dto = expectOk(
      await WhiteboardService.setArchived(ACTOR, WS, 'b1', true),
    )
    expect(dto.archivedAt).not.toBeNull()
    expect(boards.setArchived.mock.calls[0][1].archivedAt).toBeInstanceOf(Date)

    expectOk(await WhiteboardService.setArchived(ACTOR, WS, 'b1', false))
    expect(boards.setArchived.mock.calls[1][1].archivedAt).toBeNull()
    expect(index).toHaveBeenCalledTimes(2)
  })

  it('refuses a MEMBER on someone else’s board but lets an ADMIN', async () => {
    boards.findById.mockResolvedValue(ok(board({ createdById: 'someone' })))
    expectErr(
      await WhiteboardService.setArchived(ACTOR, WS, 'b1', true),
      'WHITEBOARD_FORBIDDEN',
    )

    as('ADMIN')
    boards.setArchived.mockResolvedValue(ok(board()))
    expectOk(await WhiteboardService.setArchived(ACTOR, WS, 'b1', true))
  })

  it('stops on read and write errors, and denies VIEWERs', async () => {
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardService.setArchived(ACTOR, WS, 'b1', true),
      'DATABASE_ERROR',
    )
    boards.findById.mockResolvedValue(ok(board({ createdById: ACTOR })))
    boards.setArchived.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.setArchived(ACTOR, WS, 'b1', true),
      'DATABASE_ERROR',
    )
    as('VIEWER')
    expectErr(
      await WhiteboardService.setArchived(ACTOR, WS, 'b1', true),
      'WHITEBOARD_FORBIDDEN',
    )
  })
})

describe('saveScene()', () => {
  const recent = new Date()

  it('saves and skips the version inside the cadence', async () => {
    boards.saveScene.mockResolvedValue(
      ok(
        board({
          revision: 4,
          versionedRevision: 3,
          lastVersionAt: recent,
          editedAt: recent,
        }),
      ),
    )

    const result = expectOk(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 3,
      }),
    )

    expect(result).toEqual({
      revision: 4,
      editedAt: recent.toISOString(),
      versionCreated: false,
    })
    const call = boards.saveScene.mock.calls[0][1]
    expect(call.baseRevision).toBe(3)
    expect(call.leaseUntil.getTime() - call.now.getTime()).toBe(60_000)
    expect(versions.create).not.toHaveBeenCalled()
  })

  it('cuts an AUTO version on the first save, after the interval and after many saves', async () => {
    versions.create.mockResolvedValue(ok(createFakeWhiteboardVersion()))
    const old = new Date(Date.now() - WHITEBOARD_AUTO_VERSION_INTERVAL_MS - 1)
    for (const saved of [
      board({ revision: 1, lastVersionAt: null }),
      board({ revision: 5, versionedRevision: 4, lastVersionAt: old }),
      board({
        revision: WHITEBOARD_AUTO_VERSION_REVISIONS,
        versionedRevision: 0,
        lastVersionAt: recent,
      }),
    ]) {
      boards.saveScene.mockResolvedValueOnce(ok(saved))
      const result = expectOk(
        await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
          scene,
          baseRevision: 0,
        }),
      )
      expect(result.versionCreated).toBe(true)
    }

    expect(versions.create).toHaveBeenCalledTimes(3)
    expect(versions.create).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        kind: 'AUTO',
        revision: 1,
        elementCount: 0,
        createdById: ACTOR,
      }),
      WHITEBOARD_AUTO_VERSIONS_KEPT,
    )
    expect(index).toHaveBeenCalledTimes(3)
  })

  it('still reports the save when the version fails', async () => {
    boards.saveScene.mockResolvedValue(ok(board({ lastVersionAt: null })))
    versions.create.mockResolvedValue(err(databaseError()))

    const result = expectOk(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
    )
    expect(result.versionCreated).toBe(false)
  })

  it('answers WHITEBOARD_LOCKED while another member holds the lease', async () => {
    boards.saveScene.mockResolvedValue(ok(null))
    const until = new Date(Date.now() + 30_000)
    boards.findById.mockResolvedValueOnce(ok(board())).mockResolvedValueOnce(
      ok(
        board({
          lockedById: 'u2',
          lockedBy: { id: 'u2', name: 'Bruno' },
          lockedUntil: until,
        }),
      ),
    )

    const error = expectErr(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
      'WHITEBOARD_LOCKED',
    )
    expect(error.message).toContain('Bruno')
    expect(error.details).toEqual({
      holderName: 'Bruno',
      until: until.toISOString(),
    })
  })

  it('answers WHITEBOARD_REVISION_CONFLICT on a stale revision', async () => {
    boards.saveScene.mockResolvedValue(ok(null))
    boards.findById.mockResolvedValue(
      ok(
        board({
          lockedById: ACTOR,
          lockedBy: { id: ACTOR, name: 'Eu' },
          lockedUntil: new Date(Date.now() + 30_000),
        }),
      ),
    )

    expectErr(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
      'WHITEBOARD_REVISION_CONFLICT',
    )
  })

  it('propagates the re-read error after a refused save', async () => {
    boards.saveScene.mockResolvedValue(ok(null))
    boards.findById
      .mockResolvedValueOnce(ok(board()))
      .mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
      'DATABASE_ERROR',
    )
  })

  it('refuses archived boards, VIEWERs and propagates errors', async () => {
    boards.findById.mockResolvedValueOnce(ok(board({ archivedAt: new Date() })))
    expectErr(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
      'WHITEBOARD_FORBIDDEN',
    )
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
      'DATABASE_ERROR',
    )
    boards.saveScene.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
      'DATABASE_ERROR',
    )
    as('VIEWER')
    expectErr(
      await WhiteboardService.saveScene(ACTOR, WS, 'b1', {
        scene,
        baseRevision: 0,
      }),
      'WHITEBOARD_FORBIDDEN',
    )
  })
})

describe('acquireLock() / releaseLock()', () => {
  it('grants the lease to an editor', async () => {
    const until = new Date(Date.now() + 60_000)
    boards.acquireLock.mockResolvedValue(
      ok(
        board({
          lockedById: ACTOR,
          lockedBy: { id: ACTOR, name: 'Eu' },
          lockedUntil: until,
        }),
      ),
    )

    const state = expectOk(await WhiteboardService.acquireLock(ACTOR, WS, 'b1'))

    expect(state).toEqual({
      canEdit: true,
      readOnlyRole: false,
      lock: { holder: { id: ACTOR, name: 'Eu' }, until: until.toISOString() },
    })
  })

  it('reports who holds a live lease', async () => {
    boards.acquireLock.mockResolvedValue(
      ok(
        board({
          lockedById: 'u2',
          lockedBy: { id: 'u2', name: 'Bruno' },
          lockedUntil: new Date(Date.now() + 60_000),
        }),
      ),
    )

    const state = expectOk(await WhiteboardService.acquireLock(ACTOR, WS, 'b1'))
    expect(state.canEdit).toBe(false)
    expect(state.lock?.holder.name).toBe('Bruno')
  })

  it('never hands the lease to a VIEWER or on an archived board', async () => {
    as('VIEWER')
    expect(
      expectOk(await WhiteboardService.acquireLock(ACTOR, WS, 'b1')),
    ).toEqual({ canEdit: false, readOnlyRole: true, lock: null })

    as('MEMBER')
    boards.findById.mockResolvedValue(ok(board({ archivedAt: new Date() })))
    expect(
      expectOk(await WhiteboardService.acquireLock(ACTOR, WS, 'b1'))
        .readOnlyRole,
    ).toBe(false)
    expect(boards.acquireLock).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    settings.isEnabled.mockResolvedValueOnce(ok(false))
    expectErr(
      await WhiteboardService.acquireLock(ACTOR, WS, 'b1'),
      'WHITEBOARD_DISABLED',
    )
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardService.acquireLock(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
    boards.acquireLock.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.acquireLock(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
  })

  it('releases the actor’s lease', async () => {
    boards.releaseLock.mockResolvedValue(ok(true))
    expect(
      expectOk(await WhiteboardService.releaseLock(ACTOR, WS, 'b1')),
    ).toEqual({ released: true })
    expect(boards.releaseLock).toHaveBeenCalledWith('b1', ACTOR)

    boards.releaseLock.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardService.releaseLock(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardService.releaseLock(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
    memberships.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await WhiteboardService.releaseLock(ACTOR, WS, 'b1'), 'FORBIDDEN')
  })
})
