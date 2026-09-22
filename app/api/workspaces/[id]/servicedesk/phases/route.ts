import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdPhaseSchema,
  ListSdPhasesSchema,
} from '@/src/schemas/sd-phase.schema'
import { SdPhaseService } from '@/src/services/sd-phase.service'

export const GET = sdConfigRoute({
  query: ListSdPhasesSchema,
  handler: ({ userId, params, query }) =>
    SdPhaseService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/phases',
  body: CreateSdPhaseSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdPhaseService.create(userId, params.id, body),
})
