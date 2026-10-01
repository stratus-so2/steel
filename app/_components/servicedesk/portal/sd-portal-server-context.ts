import 'server-only'
import { cache } from 'react'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'
import { SdAccess } from '@/src/services/sd-access'
import { SdSettingsService } from '@/src/services/sd-settings.service'
import type { SdTicketTypeDTO } from '@/types/sd-settings'

/** Quem está no portal do solicitante e como o portal está configurado. */
export interface SdPortalViewer {
  userId: string
  userName: string
  workspaceId: string
  workspaceSlug: string
  /** Agentes também podem abrir o portal (para conferir o que o cliente vê). */
  isAgent: boolean
  isAdmin: boolean
  /** `SdSettings.portalEnabled` — desligado, as telas mostram o aviso. */
  portalEnabled: boolean
  /** Tipos que o solicitante pode abrir pelo portal. */
  portalTicketTypes: SdTicketTypeDTO[]
  /** Pré-atendimento por IA ligado (`aiEnabled && aiPreServiceEnabled`). */
  aiPreServiceEnabled: boolean
}

/**
 * Contexto das telas do portal: sessão → membro do workspace → acesso ao
 * ServiceDesk (`sd-portal:VIEW`) → configuração do módulo. `null` quando não
 * há acesso — a página chama `notFound()` no próprio corpo.
 */
export const getSdPortalViewer = cache(
  async (workspaceSlug: string): Promise<SdPortalViewer | null> => {
    const session = await getAuthSession()
    if (!session.ok) return null

    const membership = await MembershipService.getByUserAndSlug(
      session.value.user.id,
      workspaceSlug,
    )
    if (!membership.ok || !membership.value) return null

    const workspaceId = membership.value.workspaceId
    const userId = session.value.user.id
    const access = await SdAccess.resolve(userId, workspaceId, {
      resource: 'sd-portal',
      action: 'VIEW',
    })
    if (!access.ok) return null

    const settings = await SdSettingsService.get(userId, workspaceId)
    if (!settings.ok) return null

    return {
      userId,
      userName: session.value.user.name ?? '',
      workspaceId,
      workspaceSlug,
      isAgent: access.value.isAgent,
      isAdmin: access.value.isAdmin,
      portalEnabled: settings.value.portalEnabled,
      portalTicketTypes: settings.value.portalTicketTypes,
      aiPreServiceEnabled:
        settings.value.aiEnabled && settings.value.aiPreServiceEnabled,
    }
  },
)
