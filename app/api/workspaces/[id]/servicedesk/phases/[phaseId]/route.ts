import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdPhaseSchema } from '@/src/schemas/sd-phase.schema'
import { SdPhaseService } from '@/src/services/sd-phase.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/phases/[phaseId]',
  body: UpdateSdPhaseSchema,
  handler: ({ userId, params, body }) =>
    SdPhaseService.update(userId, params.id, params.phaseId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/phases/[phaseId]',
  handler: ({ userId, params }) =>
    SdPhaseService.remove(userId, params.id, params.phaseId),
})
