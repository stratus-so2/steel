import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import type {
  WhiteboardDTO,
  WhiteboardLockStateDTO,
  WhiteboardSaveResultDTO,
  WhiteboardSummaryDTO,
} from '@/types/whiteboard'
import {
  whiteboardForbidden,
  whiteboardLocked,
  whiteboardRevisionConflict,
} from '../errors'
import { err, ok, type Result } from '../lib/result'
import { indexSearchDocument } from '../lib/search/index-hooks'
import {
  countLiveElements,
  toWhiteboardDTO,
  toWhiteboardLockDTO,
  toWhiteboardScene,
  toWhiteboardSummaryDTO,
} from '../mappers/whiteboard.mapper'
import {
  type Whiteboard,
  WhiteboardRepository,
} from '../repositories/whiteboard.repository'
import { WhiteboardVersionRepository } from '../repositories/whiteboard-version.repository'
import {
  type CreateWhiteboardDTO,
  EMPTY_WHITEBOARD_SCENE,
  type ListWhiteboardsDTO,
  type SaveWhiteboardSceneDTO,
  type UpdateWhiteboardDTO,
  WHITEBOARD_TITLE_MAX,
} from '../schemas/whiteboard.schema'
import {
  assertWhiteboardEditor,
  assertWhiteboardMember,
  loadWorkspaceBoard,
} from './_whiteboard-access'
import type { MembershipContext } from './authz'

/** Edit lease length; the open canvas renews it every ~20 s. */
export const WHITEBOARD_LEASE_MS = 60_000
/** Automatic version cadence: every 10 minutes of editing… */
export const WHITEBOARD_AUTO_VERSION_INTERVAL_MS = 10 * 60_000
/** …or every 100 saves, whichever comes first. */
export const WHITEBOARD_AUTO_VERSION_REVISIONS = 100
/** Newest automatic versions kept per board (MANUAL/RESTORE are kept). */
export const WHITEBOARD_AUTO_VERSIONS_KEPT = 50

export const UNTITLED_WHITEBOARD = 'Quadro sem título'

const ARCHIVED_MESSAGE = 'Quadro arquivado: restaure-o para editar'

function shouldCutAutoVersion(board: Whiteboard, now: Date): boolean {
  if (!board.lastVersionAt) return true
  if (
    now.getTime() - board.lastVersionAt.getTime() >=
    WHITEBOARD_AUTO_VERSION_INTERVAL_MS
  ) {
    return true
  }
  return (
    board.revision - board.versionedRevision >=
    WHITEBOARD_AUTO_VERSION_REVISIONS
  )
}

/** A MEMBER archives what it created; OWNER/ADMIN archive anything. */
function canArchive(
  membership: MembershipContext,
  board: Whiteboard,
  actorId: string,
): boolean {
  return membership.isPrivileged || board.createdById === actorId
}

function audit(
  action: 'create' | 'update' | 'archive' | 'restore',
  actorId: string,
  targetId: string | null,
  result: Result<unknown>,
  meta?: Record<string, unknown>,
) {
  auditMutation({
    entity: 'whiteboard',
    action,
    actorId,
    targetId,
    ...(result.ok
      ? {}
      : { outcome: 'failure' as const, reason: result.error.code }),
    ...(meta ? { meta } : {}),
  })
}

export const WhiteboardService = {
  async list(
    actorId: string,
    workspaceId: string,
    filter: ListWhiteboardsDTO,
  ): Promise<Result<WhiteboardSummaryDTO[]>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const boards = await WhiteboardRepository.listByWorkspace(
      workspaceId,
      filter,
    )
    if (!boards.ok) return boards

    return ok(boards.value.map(toWhiteboardSummaryDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
  ): Promise<Result<WhiteboardDTO>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    return ok(toWhiteboardDTO(board.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateWhiteboardDTO,
  ): Promise<Result<WhiteboardDTO>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhiteboardRepository.create({
      workspaceId,
      title: dto.title,
      scene: EMPTY_WHITEBOARD_SCENE as Prisma.InputJsonValue,
      createdById: actorId,
    })
    audit('create', actorId, result.ok ? result.value.id : null, result)
    if (!result.ok) return result

    void indexSearchDocument('whiteboard', workspaceId, result.value.id)
    return ok(toWhiteboardDTO(result.value))
  },

  async rename(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
    dto: UpdateWhiteboardDTO,
  ): Promise<Result<WhiteboardDTO>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    const result = await WhiteboardRepository.rename(whiteboardId, {
      title: dto.title,
      updatedById: actorId,
    })
    audit('update', actorId, whiteboardId, result, { fields: ['title'] })
    if (!result.ok) return result

    void indexSearchDocument('whiteboard', workspaceId, whiteboardId)
    return ok(toWhiteboardDTO(result.value))
  },

  /** New board with the same scene (no history, no lease). */
  async duplicate(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
  ): Promise<Result<WhiteboardDTO>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const source = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!source.ok) return source

    const suffix = ' (cópia)'
    const base = source.value.title || UNTITLED_WHITEBOARD
    const title = `${base.slice(0, WHITEBOARD_TITLE_MAX - suffix.length)}${suffix}`

    const result = await WhiteboardRepository.create({
      workspaceId,
      title,
      scene: toWhiteboardScene(source.value.scene) as Prisma.InputJsonValue,
      createdById: actorId,
    })
    audit('create', actorId, result.ok ? result.value.id : null, result, {
      duplicatedFrom: whiteboardId,
    })
    if (!result.ok) return result

    void indexSearchDocument('whiteboard', workspaceId, result.value.id)
    return ok(toWhiteboardDTO(result.value))
  },

  async setArchived(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
    archived: boolean,
  ): Promise<Result<WhiteboardDTO>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    if (!canArchive(membership.value, board.value, actorId)) {
      return err(
        whiteboardForbidden(
          'Só quem criou o quadro ou um administrador pode arquivá-lo',
        ),
      )
    }

    const result = await WhiteboardRepository.setArchived(whiteboardId, {
      archivedAt: archived ? new Date() : null,
      updatedById: actorId,
    })
    audit(archived ? 'archive' : 'restore', actorId, whiteboardId, result)
    if (!result.ok) return result

    // The loader skips archived boards, so a refresh drops or re-adds it.
    void indexSearchDocument('whiteboard', workspaceId, whiteboardId)
    return ok(toWhiteboardDTO(result.value))
  },

  /**
   * Autosave. Optimistic on `baseRevision` and gated by the edit lease;
   * cuts an automatic version on the cadence above. Not audited (it runs
   * every few seconds while drawing), like the wiki's content autosave.
   */
  async saveScene(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
    dto: SaveWhiteboardSceneDTO,
  ): Promise<Result<WhiteboardSaveResultDTO>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board
    if (board.value.archivedAt)
      return err(whiteboardForbidden(ARCHIVED_MESSAGE))

    const now = new Date()
    const saved = await WhiteboardRepository.saveScene(whiteboardId, {
      scene: dto.scene as Prisma.InputJsonValue,
      baseRevision: dto.baseRevision,
      actorId,
      now,
      leaseUntil: new Date(now.getTime() + WHITEBOARD_LEASE_MS),
    })
    if (!saved.ok) return saved

    if (!saved.value) {
      const fresh = await WhiteboardRepository.findById(whiteboardId)
      if (!fresh.ok) return fresh
      const lock = toWhiteboardLockDTO(fresh.value, now)
      if (lock && lock.holder.id !== actorId) {
        return err(
          whiteboardLocked({
            name: lock.holder.name,
            until: new Date(lock.until),
          }),
        )
      }
      return err(whiteboardRevisionConflict())
    }

    let versionCreated = false
    if (shouldCutAutoVersion(saved.value, now)) {
      const version = await WhiteboardVersionRepository.create(
        whiteboardId,
        {
          kind: 'AUTO',
          scene: dto.scene as Prisma.InputJsonValue,
          revision: saved.value.revision,
          elementCount: countLiveElements(dto.scene),
          createdById: actorId,
        },
        WHITEBOARD_AUTO_VERSIONS_KEPT,
      )
      if (version.ok) {
        versionCreated = true
        // The board text changed: refresh its search body with the version.
        void indexSearchDocument('whiteboard', workspaceId, whiteboardId)
      } else {
        // The save itself succeeded; the next save retries the version.
        logger.warn('whiteboard.auto_version.failed', {
          component: 'WhiteboardService',
          whiteboardId,
          code: version.error.code,
        })
      }
    }

    return ok({
      revision: saved.value.revision,
      editedAt: saved.value.editedAt.toISOString(),
      versionCreated,
    })
  },

  /**
   * Takes or renews the edit lease. VIEWERs and archived boards never take
   * it; anyone else gets it unless another member holds a live one.
   */
  async acquireLock(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
  ): Promise<Result<WhiteboardLockStateDTO>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    const now = new Date()
    const readOnlyRole = membership.value.role === 'VIEWER'
    if (readOnlyRole || board.value.archivedAt) {
      return ok({
        canEdit: false,
        readOnlyRole,
        lock: toWhiteboardLockDTO(board.value, now),
      })
    }

    const result = await WhiteboardRepository.acquireLock(whiteboardId, {
      actorId,
      now,
      leaseUntil: new Date(now.getTime() + WHITEBOARD_LEASE_MS),
    })
    if (!result.ok) return result

    return ok({
      canEdit: result.value.lockedById === actorId,
      readOnlyRole: false,
      lock: toWhiteboardLockDTO(result.value, now),
    })
  },

  async releaseLock(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
  ): Promise<Result<{ released: boolean }>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    const result = await WhiteboardRepository.releaseLock(whiteboardId, actorId)
    if (!result.ok) return result

    return ok({ released: result.value })
  },
}
