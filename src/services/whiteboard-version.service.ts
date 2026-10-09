import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import type {
  WhiteboardDTO,
  WhiteboardVersionDTO,
  WhiteboardVersionSummaryDTO,
} from '@/types/whiteboard'
import {
  whiteboardForbidden,
  whiteboardLocked,
  whiteboardVersionNotFound,
} from '../errors'
import { err, ok, type Result } from '../lib/result'
import { indexSearchDocument } from '../lib/search/index-hooks'
import {
  countLiveElements,
  toWhiteboardDTO,
  toWhiteboardLockDTO,
  toWhiteboardScene,
  toWhiteboardVersionDTO,
  toWhiteboardVersionSummaryDTO,
} from '../mappers/whiteboard.mapper'
import { WhiteboardVersionRepository } from '../repositories/whiteboard-version.repository'
import type { CreateWhiteboardVersionDTO } from '../schemas/whiteboard.schema'
import {
  assertWhiteboardEditor,
  assertWhiteboardMember,
  loadWorkspaceBoard,
} from './_whiteboard-access'
import { WHITEBOARD_AUTO_VERSIONS_KEPT } from './whiteboard.service'

/**
 * History of a board. Automatic versions come from the save cadence
 * (`WhiteboardService.saveScene`); this service lists them, cuts named
 * ("Salvar versão") ones and restores — a restore is a new version, the
 * history is never rewritten.
 */
export const WhiteboardVersionService = {
  async list(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
  ): Promise<Result<WhiteboardVersionSummaryDTO[]>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    const versions = await WhiteboardVersionRepository.listByBoard(whiteboardId)
    if (!versions.ok) return versions

    return ok(versions.value.map(toWhiteboardVersionSummaryDTO))
  },

  async get(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
    versionId: string,
  ): Promise<Result<WhiteboardVersionDTO>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    const version = await WhiteboardVersionRepository.findById(versionId)
    if (!version.ok) return version
    if (version.value.whiteboardId !== whiteboardId) {
      return err(whiteboardVersionNotFound())
    }

    return ok(toWhiteboardVersionDTO(version.value))
  },

  /** "Salvar versão": snapshot of the stored scene, kept forever. */
  async create(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
    dto: CreateWhiteboardVersionDTO,
  ): Promise<Result<WhiteboardVersionSummaryDTO>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    const scene = toWhiteboardScene(board.value.scene)
    const result = await WhiteboardVersionRepository.create(
      whiteboardId,
      {
        kind: 'MANUAL',
        name: dto.name ?? null,
        scene: scene as Prisma.InputJsonValue,
        revision: board.value.revision,
        elementCount: countLiveElements(scene),
        createdById: actorId,
      },
      WHITEBOARD_AUTO_VERSIONS_KEPT,
    )
    auditMutation({
      entity: 'whiteboard_version',
      action: 'create',
      actorId,
      targetId: result.ok ? result.value.id : whiteboardId,
      ...(result.ok
        ? {}
        : { outcome: 'failure' as const, reason: result.error.code }),
      meta: { whiteboardId, named: Boolean(dto.name) },
    })
    if (!result.ok) return result

    return ok(toWhiteboardVersionSummaryDTO(result.value))
  },

  /**
   * Puts an older scene back. Refused while another member holds the edit
   * lease (their canvas would overwrite it on the next autosave).
   */
  async restore(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
    versionId: string,
  ): Promise<Result<WhiteboardDTO>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board
    if (board.value.archivedAt) {
      return err(
        whiteboardForbidden('Quadro arquivado: restaure-o para editar'),
      )
    }

    const now = new Date()
    const lock = toWhiteboardLockDTO(board.value, now)
    if (lock && lock.holder.id !== actorId) {
      return err(
        whiteboardLocked({
          name: lock.holder.name,
          until: new Date(lock.until),
        }),
      )
    }

    const version = await WhiteboardVersionRepository.findById(versionId)
    if (!version.ok) return version
    if (version.value.whiteboardId !== whiteboardId) {
      return err(whiteboardVersionNotFound())
    }

    const result = await WhiteboardVersionRepository.restore(
      board.value,
      version.value,
      {
        actorId,
        now,
        keepAuto: WHITEBOARD_AUTO_VERSIONS_KEPT,
        currentElementCount: countLiveElements(
          toWhiteboardScene(board.value.scene),
        ),
      },
    )
    auditMutation({
      entity: 'whiteboard_version',
      action: 'restore',
      actorId,
      targetId: versionId,
      ...(result.ok
        ? {}
        : { outcome: 'failure' as const, reason: result.error.code }),
      meta: { whiteboardId },
    })
    if (!result.ok) return result

    void indexSearchDocument('whiteboard', workspaceId, whiteboardId)
    return ok(toWhiteboardDTO(result.value, now))
  },
}
