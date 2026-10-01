import 'server-only'
import { cache } from 'react'
import { getAuthSession } from '@/src/lib/auth-session'
import { can } from '@/src/lib/permissions'
import { CrmDashboardService } from '@/src/services/crm-dashboard.service'
import { MembershipService } from '@/src/services/membership.service'
import { SdAccess } from '@/src/services/sd-access'
import type { CrmDashboardDTO } from '@/types/crm-dashboard'

/** Quem está vendo os painéis do ServiceDesk e o que pode fazer. */
export interface SdDashboardViewer {
  userId: string
  workspaceId: string
  workspaceSlug: string
  isAgent: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * Contexto das telas de painéis: sessão → membro do workspace → acesso ao
 * ServiceDesk com `sd-dashboards:VIEW`. `null` quando não há acesso (a
 * página chama `notFound()` no próprio corpo) e `isAgent: false` para
 * solicitantes, que não veem painéis da operação.
 */
export const getSdDashboardViewer = cache(
  async (workspaceSlug: string): Promise<SdDashboardViewer | null> => {
    const session = await getAuthSession()
    if (!session.ok) return null

    const membership = await MembershipService.getByUserAndSlug(
      session.value.user.id,
      workspaceSlug,
    )
    if (!membership.ok || !membership.value) return null

    const workspaceId = membership.value.workspaceId
    const access = await SdAccess.resolve(session.value.user.id, workspaceId, {
      resource: 'sd-dashboards',
      action: 'VIEW',
    })
    if (!access.ok) return null

    const ctx = access.value
    const allows = (action: 'CREATE' | 'EDIT' | 'DELETE') =>
      ctx.isAgent &&
      (ctx.isPrivileged ||
        (ctx.permissions !== null &&
          can(ctx.permissions, 'sd-dashboards', action)))

    return {
      userId: session.value.user.id,
      workspaceId,
      workspaceSlug,
      isAgent: ctx.isAgent,
      canCreate: allows('CREATE'),
      canEdit: allows('EDIT'),
      canDelete: allows('DELETE'),
    }
  },
)

/** Painéis do módulo, já autorizados (lista vazia quando recusado). */
export const listSdDashboards = cache(
  async (viewer: SdDashboardViewer): Promise<CrmDashboardDTO[]> => {
    const dashboards = await CrmDashboardService.list(
      viewer.userId,
      viewer.workspaceId,
      'SERVICE_DESK',
    )
    return dashboards.ok ? dashboards.value : []
  },
)

/**
 * Um painel do ServiceDesk pelo id (a API só expõe a lista do módulo).
 * `null` quando o painel não existe ou é de outro módulo/workspace.
 */
export const getSdDashboard = cache(
  async (
    viewer: SdDashboardViewer,
    dashboardId: string,
  ): Promise<CrmDashboardDTO | null> => {
    const dashboards = await listSdDashboards(viewer)
    return dashboards.find((d) => d.id === dashboardId) ?? null
  },
)
