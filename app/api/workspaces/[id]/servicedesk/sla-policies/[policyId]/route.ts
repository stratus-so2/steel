import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdSlaPolicySchema } from '@/src/schemas/sd-sla-policy.schema'
import { SdSlaPolicyService } from '@/src/services/sd-sla-policy.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/sla-policies/[policyId]',
  body: UpdateSdSlaPolicySchema,
  handler: ({ userId, params, body }) =>
    SdSlaPolicyService.update(userId, params.id, params.policyId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/sla-policies/[policyId]',
  handler: ({ userId, params }) =>
    SdSlaPolicyService.remove(userId, params.id, params.policyId),
})
