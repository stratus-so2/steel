import { validationError } from '@/src/errors'
import { err } from '@/src/lib/result'
import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdDashboardSourceSchema } from '@/src/schemas/sd-dashboard.schema'
import { SdDashboardSourceService } from '@/src/services/sd-dashboard-source.service'

/** Linhas achatadas de uma fonte de dados dos dashboards do ServiceDesk. */
export const GET = sdConfigRoute({
  handler: async ({ userId, params }) => {
    const source = SdDashboardSourceSchema.safeParse(params.source)
    if (!source.success) {
      return err(validationError('Fonte de dados desconhecida'))
    }
    return SdDashboardSourceService.rows(userId, params.id, source.data)
  },
})
