import { whiteboardDisabled, whiteboardForbidden } from '../errors'
import { err, ok, type Result } from '../lib/result'
import {
  type Whiteboard,
  WhiteboardRepository,
  WhiteboardSettingsRepository,
} from '../repositories/whiteboard.repository'
import { assertMember, type MembershipContext } from './authz'

/**
 * Entry gate of every whiteboard operation: workspace membership first (a
 * non-member never learns whether the feature is on), then the workspace
 * switch in Ajustes › Quadro-branco.
 */
export async function assertWhiteboardMember(
  actorId: string,
  workspaceId: string,
): Promise<Result<MembershipContext>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership

  const enabled = await WhiteboardSettingsRepository.isEnabled(workspaceId)
  if (!enabled.ok) return enabled
  if (!enabled.value) return err(whiteboardDisabled())

  return membership
}

/** Same gate, plus a role that edits: VIEWER only reads boards. */
export async function assertWhiteboardEditor(
  actorId: string,
  workspaceId: string,
): Promise<Result<MembershipContext>> {
  const membership = await assertWhiteboardMember(actorId, workspaceId)
  if (!membership.ok) return membership
  if (membership.value.role === 'VIEWER') {
    return err(whiteboardForbidden('Leitores só visualizam os quadros'))
  }
  return membership
}

/**
 * Loads a board of the workspace. A board of another workspace answers as
 * not found, so ids never leak across tenants.
 */
export async function loadWorkspaceBoard(
  workspaceId: string,
  whiteboardId: string,
): Promise<Result<Whiteboard>> {
  const board = await WhiteboardRepository.findById(whiteboardId)
  if (!board.ok) return board
  if (board.value.workspaceId !== workspaceId) {
    return err(whiteboardForbidden('Sem acesso a este quadro'))
  }
  return ok(board.value)
}
