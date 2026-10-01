import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdDashboardSeedService } from '@/src/services/sd-dashboard-seed.service'
import { SdSeedService } from '@/src/services/sd-seed.service'

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/settings/restore-defaults',
  handler: async ({ userId, params }) => {
    const restored = await SdSeedService.restoreDefaults(userId, params.id)
    // Só depois de o service confirmar que é admin: recria os dashboards
    // padrão que faltarem (falha só é logada pelo seed).
    if (restored.ok)
      await SdDashboardSeedService.seedDefaults(params.id, userId)
    return restored
  },
})
