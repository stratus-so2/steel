import type { Prisma, Whiteboard as WhiteboardRow } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { notFound, whiteboardNotFound } from '../errors'
import { err, ok, type Result } from '../lib/result'
import { dbError } from './db-error'

const PERSON = { select: { id: true, name: true } } as const

const WITH_PEOPLE = {
  createdBy: PERSON,
  updatedBy: PERSON,
  lockedBy: PERSON,
} satisfies Prisma.WhiteboardInclude

type Person = { id: string; name: string } | null

export type Whiteboard = WhiteboardRow & {
  createdBy: Person
  updatedBy: Person
  lockedBy: Person
}

/** A list row: everything but the (possibly large) scene. */
export type WhiteboardListItem = Omit<Whiteboard, 'scene'>

const LIST_SELECT = {
  id: true,
  workspaceId: true,
  title: true,
  revision: true,
  versionedRevision: true,
  lastVersionAt: true,
  thumbnailAt: true,
  lockedById: true,
  lockedUntil: true,
  createdById: true,
  updatedById: true,
  archivedAt: true,
  editedAt: true,
  createdAt: true,
  updatedAt: true,
  ...WITH_PEOPLE,
} satisfies Prisma.WhiteboardSelect

const LIST_LIMIT = 200

/** Lease is free for `actorId`: unheld, already theirs, or expired. */
function leaseAvailable(
  actorId: string,
  now: Date,
): Prisma.WhiteboardWhereInput {
  return {
    OR: [
      { lockedById: null },
      { lockedById: actorId },
      { lockedUntil: null },
      { lockedUntil: { lt: now } },
    ],
  }
}

export const WhiteboardRepository = {
  async findById(id: string): Promise<Result<Whiteboard>> {
    try {
      const board = await prisma.whiteboard.findUnique({
        where: { id },
        include: WITH_PEOPLE,
      })
      if (!board) return err(whiteboardNotFound())
      return ok(board)
    } catch (error) {
      return err(dbError('Failed to find whiteboard by id', error))
    }
  },

  /** Newest edit first; `q` matches the title (case/accent-insensitive). */
  async listByWorkspace(
    workspaceId: string,
    filter: { q: string; archived: boolean },
  ): Promise<Result<WhiteboardListItem[]>> {
    try {
      const boards = await prisma.whiteboard.findMany({
        where: {
          workspaceId,
          archivedAt: filter.archived ? { not: null } : null,
          ...(filter.q
            ? { title: { contains: filter.q, mode: 'insensitive' } }
            : {}),
        },
        orderBy: [{ editedAt: 'desc' }, { id: 'asc' }],
        select: LIST_SELECT,
        take: LIST_LIMIT,
      })
      return ok(boards)
    } catch (error) {
      return err(dbError('Failed to list whiteboards', error))
    }
  },

  async create(data: {
    workspaceId: string
    title: string
    scene: Prisma.InputJsonValue
    createdById: string
  }): Promise<Result<Whiteboard>> {
    try {
      const board = await prisma.whiteboard.create({
        data: { ...data, updatedById: data.createdById },
        include: WITH_PEOPLE,
      })
      return ok(board)
    } catch (error) {
      return err(dbError('Failed to create whiteboard', error))
    }
  },

  async rename(
    id: string,
    data: { title: string; updatedById: string },
  ): Promise<Result<Whiteboard>> {
    try {
      const board = await prisma.whiteboard.update({
        where: { id },
        data: { ...data, editedAt: new Date() },
        include: WITH_PEOPLE,
      })
      return ok(board)
    } catch (error) {
      return err(dbError('Failed to rename whiteboard', error))
    }
  },

  /**
   * Conditional save: only when the stored revision is `baseRevision` and
   * the lease is free for the actor. Renews the actor's lease on success.
   * `null` = nothing matched (stale revision or someone else's lease).
   */
  async saveScene(
    id: string,
    data: {
      scene: Prisma.InputJsonValue
      baseRevision: number
      actorId: string
      now: Date
      leaseUntil: Date
    },
  ): Promise<Result<Whiteboard | null>> {
    try {
      const updated = await prisma.whiteboard.updateMany({
        where: {
          id,
          revision: data.baseRevision,
          ...leaseAvailable(data.actorId, data.now),
        },
        data: {
          scene: data.scene,
          revision: { increment: 1 },
          updatedById: data.actorId,
          editedAt: data.now,
          lockedById: data.actorId,
          lockedUntil: data.leaseUntil,
        },
      })
      if (updated.count === 0) return ok(null)
      const board = await prisma.whiteboard.findUniqueOrThrow({
        where: { id },
        include: WITH_PEOPLE,
      })
      return ok(board)
    } catch (error) {
      return err(dbError('Failed to save whiteboard scene', error))
    }
  },

  /**
   * Takes or renews the edit lease when it is free for the actor and
   * returns the board either way — the caller reads `lockedById` to know
   * who holds it.
   */
  async acquireLock(
    id: string,
    data: { actorId: string; now: Date; leaseUntil: Date },
  ): Promise<Result<Whiteboard>> {
    try {
      await prisma.whiteboard.updateMany({
        where: { id, ...leaseAvailable(data.actorId, data.now) },
        data: { lockedById: data.actorId, lockedUntil: data.leaseUntil },
      })
      const board = await prisma.whiteboard.findUniqueOrThrow({
        where: { id },
        include: WITH_PEOPLE,
      })
      return ok(board)
    } catch (error) {
      return err(dbError('Failed to acquire whiteboard lock', error))
    }
  },

  /** Drops the lease if `actorId` holds it; a no-op otherwise. */
  async releaseLock(id: string, actorId: string): Promise<Result<boolean>> {
    try {
      const released = await prisma.whiteboard.updateMany({
        where: { id, lockedById: actorId },
        data: { lockedById: null, lockedUntil: null },
      })
      return ok(released.count > 0)
    } catch (error) {
      return err(dbError('Failed to release whiteboard lock', error))
    }
  },

  async setArchived(
    id: string,
    data: { archivedAt: Date | null; updatedById: string },
  ): Promise<Result<Whiteboard>> {
    try {
      const board = await prisma.whiteboard.update({
        where: { id },
        // Archiving also drops the lease: nobody edits an archived board.
        data: {
          ...data,
          ...(data.archivedAt ? { lockedById: null, lockedUntil: null } : {}),
        },
        include: WITH_PEOPLE,
      })
      return ok(board)
    } catch (error) {
      return err(dbError('Failed to archive whiteboard', error))
    }
  },

  async setThumbnailAt(id: string, at: Date): Promise<Result<Date>> {
    try {
      await prisma.whiteboard.update({
        where: { id },
        data: { thumbnailAt: at },
        select: { id: true },
      })
      return ok(at)
    } catch (error) {
      return err(dbError('Failed to store whiteboard thumbnail time', error))
    }
  },
}

export const WhiteboardSettingsRepository = {
  async isEnabled(workspaceId: string): Promise<Result<boolean>> {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { whiteboardEnabled: true },
      })
      if (!workspace) return err(notFound('Workspace'))
      return ok(workspace.whiteboardEnabled)
    } catch (error) {
      return err(dbError('Failed to read whiteboard settings', error))
    }
  },

  async setEnabled(
    workspaceId: string,
    enabled: boolean,
  ): Promise<Result<boolean>> {
    try {
      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { whiteboardEnabled: enabled },
        select: { whiteboardEnabled: true },
      })
      return ok(workspace.whiteboardEnabled)
    } catch (error) {
      return err(dbError('Failed to update whiteboard settings', error))
    }
  },
}
