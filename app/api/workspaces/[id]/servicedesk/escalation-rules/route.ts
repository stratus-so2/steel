import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdEscalationRuleSchema } from '@/src/schemas/sd-escalation-rule.schema'
import { SdEscalationRuleService } from '@/src/services/sd-escalation-rule.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdEscalationRuleService.list(userId, params.id),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/escalation-rules',
  body: CreateSdEscalationRuleSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdEscalationRuleService.create(userId, params.id, body),
})
