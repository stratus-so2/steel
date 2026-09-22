import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdAutomationRuleSchema,
  ListSdAutomationRulesSchema,
} from '@/src/schemas/sd-automation-rule.schema'
import { SdAutomationRuleService } from '@/src/services/sd-automation-rule.service'

export const GET = sdConfigRoute({
  query: ListSdAutomationRulesSchema,
  handler: ({ userId, params, query }) =>
    SdAutomationRuleService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/automation-rules',
  body: CreateSdAutomationRuleSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdAutomationRuleService.create(userId, params.id, body),
})
