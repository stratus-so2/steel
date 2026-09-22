import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdEscalationRuleService } from '@/src/services/sd-escalation-rule.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/escalation-rules/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdEscalationRuleService.reorder(userId, params.id, body.orderedIds),
})
