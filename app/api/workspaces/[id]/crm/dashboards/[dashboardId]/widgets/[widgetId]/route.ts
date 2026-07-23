import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { UpdateCrmDashboardWidgetSchema } from '@/src/schemas/crm-dashboard.schema'
import { CrmDashboardWidgetService } from '@/src/services/crm-dashboard.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; dashboardId: string; widgetId: string }>
}

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'PATCH /api/workspaces/[id]/crm/dashboards/[dashboardId]/widgets/[widgetId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const [{ id, dashboardId, widgetId }, body] = await Promise.all([
    ctx.params,
    request.json(),
  ])
  const parsed = UpdateCrmDashboardWidgetSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmDashboardWidgetService.update(
    auth.value.user.id,
    id,
    dashboardId,
    widgetId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/crm/dashboards/[dashboardId]/widgets/[widgetId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, dashboardId, widgetId } = await ctx.params

  const result = await CrmDashboardWidgetService.remove(
    auth.value.user.id,
    id,
    dashboardId,
    widgetId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null, 200)
})
