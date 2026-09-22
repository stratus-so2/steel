import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  SaveSdPhaseTransitionsSchema,
  SdPhaseTransitionsQuerySchema,
} from '@/src/schemas/sd-phase.schema'
import { SdPhaseService } from '@/src/services/sd-phase.service'

export const GET = sdConfigRoute({
  query: SdPhaseTransitionsQuerySchema,
  handler: ({ userId, params, query }) =>
    SdPhaseService.listTransitions(userId, params.id, query.type),
})

export const PUT = sdConfigRoute({
  consent: 'PUT /api/workspaces/[id]/servicedesk/phases/transitions',
  query: SdPhaseTransitionsQuerySchema,
  body: SaveSdPhaseTransitionsSchema,
  handler: ({ userId, params, query, body }) =>
    SdPhaseService.saveTransitions(userId, params.id, query.type, body),
})
