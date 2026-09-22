import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdSlaPolicySchema } from '@/src/schemas/sd-sla-policy.schema'
import { SdSlaPolicyService } from '@/src/services/sd-sla-policy.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) => SdSlaPolicyService.list(userId, params.id),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/sla-policies',
  body: CreateSdSlaPolicySchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdSlaPolicyService.create(userId, params.id, body),
})
