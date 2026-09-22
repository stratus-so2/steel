import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdAutomationRuleService } from '@/src/services/sd-automation-rule.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/automation-rules/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdAutomationRuleService.reorder(userId, params.id, body.orderedIds),
})
