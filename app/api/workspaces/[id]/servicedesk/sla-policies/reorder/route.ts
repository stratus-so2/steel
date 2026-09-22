import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdSlaPolicyService } from '@/src/services/sd-sla-policy.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/sla-policies/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdSlaPolicyService.reorder(userId, params.id, body.orderedIds),
})
