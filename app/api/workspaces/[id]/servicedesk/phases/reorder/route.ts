import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdPhasesSchema } from '@/src/schemas/sd-phase.schema'
import { SdPhaseService } from '@/src/services/sd-phase.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/phases/reorder',
  body: ReorderSdPhasesSchema,
  handler: ({ userId, params, body }) =>
    SdPhaseService.reorder(userId, params.id, body.ticketType, body.orderedIds),
})
