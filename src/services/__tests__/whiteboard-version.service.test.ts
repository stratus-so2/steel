import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import {
  createFakeWhiteboard,
  createFakeWhiteboardVersion,
} from '@/src/__tests__/factories/whiteboard.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, whiteboardRevisionConflict } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  WhiteboardRepository,
  WhiteboardSettingsRepository,
} from '@/src/repositories/whiteboard.repository'
import { WhiteboardVersionRepository } from '@/src/repositories/whiteboard-version.repository'
import { WhiteboardVersionService } from '../whiteboard-version.service'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whiteboard.repository')
vi.mock('@/src/repositories/whiteboard-version.repository')
vi.mock('@/src/lib/search/index-hooks', () => ({
  indexSearchDocument: vi.fn(async () => undefined),
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

const memberships = vi.mocked(MembershipRepository)
const boards = vi.mocked(WhiteboardRepository)
const settings = vi.mocked(WhiteboardSettingsRepository)
const versions = vi.mocked(WhiteboardVersionRepository)

const WS = 'ws1'
const ACTOR = 'actor'

function as(role: Role) {
  memberships.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: ACTOR, workspaceId: WS, role })),
  )
}

const board = (overrides: Parameters<typeof createFakeWhiteboard>[0] = {}) =>
  createFakeWhiteboard({ id: 'b1', workspaceId: WS, ...overrides })
const version = (
  overrides: Parameters<typeof createFakeWhiteboardVersion>[0] = {},
) => createFakeWhiteboardVersion({ id: 'v1', whiteboardId: 'b1', ...overrides })

beforeEach(() => {
  vi.clearAllMocks()
  as('MEMBER')
  settings.isEnabled.mockResolvedValue(ok(true))
  boards.findById.mockResolvedValue(ok(board()))
  versions.findById.mockResolvedValue(ok(version()))
})

describe('WhiteboardVersionService.list()', () => {
  it('lists the board history for any member, VIEWER included', async () => {
    as('VIEWER')
    versions.listByBoard.mockResolvedValue(ok([version()]))

    const list = expectOk(await WhiteboardVersionService.list(ACTOR, WS, 'b1'))

    expect(list).toHaveLength(1)
    expect(list[0]).not.toHaveProperty('scene')
  })

  it('propagates gate, board and list errors', async () => {
    settings.isEnabled.mockResolvedValueOnce(ok(false))
    expectErr(
      await WhiteboardVersionService.list(ACTOR, WS, 'b1'),
      'WHITEBOARD_DISABLED',
    )
    boards.findById.mockResolvedValueOnce(ok(board({ workspaceId: 'x' })))
    expectErr(
      await WhiteboardVersionService.list(ACTOR, WS, 'b1'),
      'WHITEBOARD_FORBIDDEN',
    )
    versions.listByBoard.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardVersionService.list(ACTOR, WS, 'b1'),
      'DATABASE_ERROR',
    )
  })
})

describe('WhiteboardVersionService.get()', () => {
  it('returns the version with its scene for preview', async () => {
    const dto = expectOk(
      await WhiteboardVersionService.get(ACTOR, WS, 'b1', 'v1'),
    )
    expect(dto.scene.elements).toHaveLength(2)
  })

  it('hides versions of other boards and propagates errors', async () => {
    versions.findById.mockResolvedValueOnce(ok(version({ whiteboardId: 'b9' })))
    expectErr(
      await WhiteboardVersionService.get(ACTOR, WS, 'b1', 'v1'),
      'WHITEBOARD_VERSION_NOT_FOUND',
    )
    versions.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardVersionService.get(ACTOR, WS, 'b1', 'v1'),
      'DATABASE_ERROR',
    )
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardVersionService.get(ACTOR, WS, 'b1', 'v1'),
      'DATABASE_ERROR',
    )
    memberships.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await WhiteboardVersionService.get(ACTOR, WS, 'b1', 'v1'),
      'FORBIDDEN',
    )
  })
})

describe('WhiteboardVersionService.create()', () => {
  it('snapshots the stored scene as a named MANUAL version', async () => {
    boards.findById.mockResolvedValue(ok(board({ revision: 7 })))
    versions.create.mockResolvedValue(
      ok(version({ kind: 'MANUAL', name: 'Entrega' })),
    )

    const dto = expectOk(
      await WhiteboardVersionService.create(ACTOR, WS, 'b1', {
        name: 'Entrega',
      }),
    )

    expect(dto.kind).toBe('MANUAL')
    expect(versions.create).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        kind: 'MANUAL',
        name: 'Entrega',
        revision: 7,
        elementCount: 2,
        createdById: ACTOR,
      }),
      50,
    )
  })

  it('accepts no name and propagates errors', async () => {
    versions.create.mockResolvedValueOnce(ok(version()))
    expectOk(await WhiteboardVersionService.create(ACTOR, WS, 'b1', {}))
    expect(versions.create.mock.calls[0][1].name).toBeNull()

    versions.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardVersionService.create(ACTOR, WS, 'b1', {}),
      'DATABASE_ERROR',
    )
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardVersionService.create(ACTOR, WS, 'b1', {}),
      'DATABASE_ERROR',
    )
  })

  it('denies VIEWERs', async () => {
    as('VIEWER')
    expectErr(
      await WhiteboardVersionService.create(ACTOR, WS, 'b1', {}),
      'WHITEBOARD_FORBIDDEN',
    )
  })
})

describe('WhiteboardVersionService.restore()', () => {
  it('restores into a new revision and returns the board', async () => {
    const current = board({ revision: 3 })
    boards.findById.mockResolvedValue(ok(current))
    versions.restore.mockResolvedValue(ok(board({ revision: 4 })))

    const dto = expectOk(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
    )

    expect(dto.revision).toBe(4)
    expect(versions.restore).toHaveBeenCalledWith(
      current,
      expect.objectContaining({ id: 'v1' }),
      expect.objectContaining({
        actorId: ACTOR,
        keepAuto: 50,
        currentElementCount: 2,
      }),
    )
  })

  it('is refused while another member edits', async () => {
    boards.findById.mockResolvedValue(
      ok(
        board({
          lockedById: 'u2',
          lockedBy: { id: 'u2', name: 'Bruno' },
          lockedUntil: new Date(Date.now() + 30_000),
        }),
      ),
    )
    expectErr(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
      'WHITEBOARD_LOCKED',
    )
  })

  it('works while the actor holds the lease', async () => {
    boards.findById.mockResolvedValue(
      ok(
        board({
          lockedById: ACTOR,
          lockedBy: { id: ACTOR, name: 'Eu' },
          lockedUntil: new Date(Date.now() + 30_000),
        }),
      ),
    )
    versions.restore.mockResolvedValue(ok(board()))
    expectOk(await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'))
  })

  it('refuses archived boards, foreign versions, VIEWERs; propagates errors', async () => {
    boards.findById.mockResolvedValueOnce(ok(board({ archivedAt: new Date() })))
    expectErr(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
      'WHITEBOARD_FORBIDDEN',
    )
    versions.findById.mockResolvedValueOnce(ok(version({ whiteboardId: 'b9' })))
    expectErr(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
      'WHITEBOARD_VERSION_NOT_FOUND',
    )
    versions.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
      'DATABASE_ERROR',
    )
    versions.restore.mockResolvedValueOnce(err(whiteboardRevisionConflict()))
    expectErr(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
      'WHITEBOARD_REVISION_CONFLICT',
    )
    boards.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
      'DATABASE_ERROR',
    )
    as('VIEWER')
    expectErr(
      await WhiteboardVersionService.restore(ACTOR, WS, 'b1', 'v1'),
      'WHITEBOARD_FORBIDDEN',
    )
  })
})
