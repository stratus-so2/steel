import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { WorkspaceIntegrationService } from '@/src/services/workspace-integration.service'

/** Ajustes > Integrações: providers, availability and connections. */
export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    WorkspaceIntegrationService.overview(userId, params.id),
})
