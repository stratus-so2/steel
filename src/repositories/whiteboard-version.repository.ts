import type {
  Prisma,
  WhiteboardVersionKind,
  WhiteboardVersion as WhiteboardVersionRow,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import {
  whiteboardRevisionConflict,
  whiteboardVersionNotFound,
} from '../errors'
import { err, ok, type Result } from '../lib/result'
import { dbError } from './db-error'
import type { Whiteboard } from './whiteboard.repository'

const PERSON = { select: { id: true, name: true } } as const

const BOARD_PEOPLE = {
  createdBy: PERSON,
  updatedBy: PERSON,
  lockedBy: PERSON,
} satisfies Prisma.WhiteboardInclude

export type WhiteboardVersion = WhiteboardVersionRow & {
  createdBy: { id: string; name: string } | null
}

export type WhiteboardVersionListItem = Omit<WhiteboardVersion, 'scene'>

const LIST_SELECT = {
  id: true,
  whiteboardId: true,
  kind: true,
  name: true,
  revision: true,
  elementCount: true,
  restoredFromId: true,
  createdById: true,
  createdAt: true,
  createdBy: PERSON,
} satisfies Prisma.WhiteboardVersionSelect

/** The history panel lists at most this many versions, newest first. */
const LIST_LIMIT = 200

export interface NewWhiteboardVersion {
  kind: WhiteboardVersionKind
  name?: string | null
  scene: Prisma.InputJsonValue
  revision: number
  elementCount: number
  restoredFromId?: string | null
  createdById: string
}

type Tx = Prisma.TransactionClient

/** Thrown inside the restore transaction to roll it back on a stale board. */
class StaleBoardError extends Error {}

/**
 * Inserts a version, moves the board's version cursor and trims the
 * automatic history to the newest `keepAuto` (MANUAL and RESTORE stay).
 */
async function insertVersion(
  tx: Tx,
  whiteboardId: string,
  data: NewWhiteboardVersion,
  keepAuto: number,
): Promise<WhiteboardVersionRow> {
  const version = await tx.whiteboardVersion.create({
    data: { ...data, whiteboardId },
  })
  await tx.whiteboard.update({
    where: { id: whiteboardId },
    data: {
      versionedRevision: data.revision,
      lastVersionAt: version.createdAt,
    },
  })
  if (data.kind === 'AUTO') {
    const stale = await tx.whiteboardVersion.findMany({
      where: { whiteboardId, kind: 'AUTO' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: keepAuto,
      select: { id: true },
    })
    if (stale.length > 0) {
      await tx.whiteboardVersion.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      })
    }
  }
  return version
}

export const WhiteboardVersionRepository = {
  async listByBoard(
    whiteboardId: string,
  ): Promise<Result<WhiteboardVersionListItem[]>> {
    try {
      const versions = await prisma.whiteboardVersion.findMany({
        where: { whiteboardId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: LIST_SELECT,
        take: LIST_LIMIT,
      })
      return ok(versions)
    } catch (error) {
      return err(dbError('Failed to list whiteboard versions', error))
    }
  },

  async findById(id: string): Promise<Result<WhiteboardVersion>> {
    try {
      const version = await prisma.whiteboardVersion.findUnique({
        where: { id },
        include: { createdBy: PERSON },
      })
      if (!version) return err(whiteboardVersionNotFound())
      return ok(version)
    } catch (error) {
      return err(dbError('Failed to find whiteboard version', error))
    }
  },

  async create(
    whiteboardId: string,
    data: NewWhiteboardVersion,
    keepAuto: number,
  ): Promise<Result<WhiteboardVersion>> {
    try {
      const created = await prisma.$transaction((tx) =>
        insertVersion(tx, whiteboardId, data, keepAuto),
      )
      const version = await prisma.whiteboardVersion.findUniqueOrThrow({
        where: { id: created.id },
        include: { createdBy: PERSON },
      })
      return ok(version)
    } catch (error) {
      return err(dbError('Failed to create whiteboard version', error))
    }
  },

  /**
   * Puts `version`'s scene back on the board. Unversioned edits are kept
   * first (an AUTO snapshot of the current scene), then the board moves to
   * a new revision and a RESTORE version records it — nothing is deleted.
   */
  async restore(
    board: Pick<Whiteboard, 'id' | 'scene' | 'revision' | 'versionedRevision'>,
    version: Pick<
      WhiteboardVersionRow,
      'id' | 'name' | 'scene' | 'elementCount'
    >,
    data: {
      actorId: string
      now: Date
      keepAuto: number
      currentElementCount: number
    },
  ): Promise<Result<Whiteboard>> {
    try {
      const restored = await prisma.$transaction(async (tx) => {
        if (board.revision > board.versionedRevision) {
          await insertVersion(
            tx,
            board.id,
            {
              kind: 'AUTO',
              name: 'Antes da restauração',
              scene: board.scene as Prisma.InputJsonValue,
              revision: board.revision,
              elementCount: data.currentElementCount,
              createdById: data.actorId,
            },
            data.keepAuto,
          )
        }
        const revision = board.revision + 1
        const updated = await tx.whiteboard.updateMany({
          where: { id: board.id, revision: board.revision },
          data: {
            scene: version.scene as Prisma.InputJsonValue,
            revision,
            updatedById: data.actorId,
            editedAt: data.now,
          },
        })
        if (updated.count === 0) throw new StaleBoardError()
        await insertVersion(
          tx,
          board.id,
          {
            kind: 'RESTORE',
            name: version.name,
            scene: version.scene as Prisma.InputJsonValue,
            revision,
            elementCount: version.elementCount,
            restoredFromId: version.id,
            createdById: data.actorId,
          },
          data.keepAuto,
        )
        return tx.whiteboard.findUniqueOrThrow({
          where: { id: board.id },
          include: BOARD_PEOPLE,
        })
      })
      return ok(restored)
    } catch (error) {
      if (error instanceof StaleBoardError) {
        return err(whiteboardRevisionConflict())
      }
      return err(dbError('Failed to restore whiteboard version', error))
    }
  },
}
