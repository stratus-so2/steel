import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdEscalationRuleSchema } from '@/src/schemas/sd-escalation-rule.schema'
import { SdEscalationRuleService } from '@/src/services/sd-escalation-rule.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/escalation-rules/[ruleId]',
  body: UpdateSdEscalationRuleSchema,
  handler: ({ userId, params, body }) =>
    SdEscalationRuleService.update(userId, params.id, params.ruleId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/escalation-rules/[ruleId]',
  handler: ({ userId, params }) =>
    SdEscalationRuleService.remove(userId, params.id, params.ruleId),
})
