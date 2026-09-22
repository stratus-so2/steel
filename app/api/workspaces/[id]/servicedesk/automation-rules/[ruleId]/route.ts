import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdAutomationRuleSchema } from '@/src/schemas/sd-automation-rule.schema'
import { SdAutomationRuleService } from '@/src/services/sd-automation-rule.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/automation-rules/[ruleId]',
  body: UpdateSdAutomationRuleSchema,
  handler: ({ userId, params, body }) =>
    SdAutomationRuleService.update(userId, params.id, params.ruleId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/automation-rules/[ruleId]',
  handler: ({ userId, params }) =>
    SdAutomationRuleService.remove(userId, params.id, params.ruleId),
})
