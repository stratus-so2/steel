import type { Role } from '@prisma/client'
import { cache } from 'react'
import type { WhiteboardDTO, WhiteboardSummaryDTO } from '@/types/whiteboard'
import { WhiteboardSettingsRepository } from '../repositories/whiteboard.repository'
import { MembershipService } from '../services/membership.service'
import { WhiteboardService } from '../services/whiteboard.service'
import { getAuthSession } from './auth-session'

export interface WhiteboardContext {
  userId: string
  userName: string
  role: Role
  workspaceId: string
  workspaceSlug: string
}

/** Session + membership + switch; `null` renders a 404, like the wiki. */
export const getWhiteboardContext = cache(
  async (workspaceSlug: string): Promise<WhiteboardContext | null> => {
    const session = await getAuthSession()
    if (!session.ok) return null

    const membership = await MembershipService.getByUserAndSlug(
      session.value.user.id,
      workspaceSlug,
    )
    if (!membership.ok || !membership.value) return null

    const enabled = await WhiteboardSettingsRepository.isEnabled(
      membership.value.workspaceId,
    )
    if (!enabled.ok || !enabled.value) return null

    return {
      userId: session.value.user.id,
      userName: session.value.user.name,
      role: membership.value.role,
      workspaceId: membership.value.workspaceId,
      workspaceSlug,
    }
  },
)

/** The live boards for the sidebar's first paint (`null` = load on client). */
export const getWhiteboards = cache(
  async (
    context: WhiteboardContext,
  ): Promise<WhiteboardSummaryDTO[] | null> => {
    const boards = await WhiteboardService.list(
      context.userId,
      context.workspaceId,
      { q: '', archived: false },
    )
    return boards.ok ? boards.value : null
  },
)

export const getWhiteboard = cache(
  async (
    context: WhiteboardContext,
    whiteboardId: string,
  ): Promise<WhiteboardDTO | null> => {
    const board = await WhiteboardService.getById(
      context.userId,
      context.workspaceId,
      whiteboardId,
    )
    return board.ok ? board.value : null
  },
)
