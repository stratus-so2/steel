import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { OpenSdApprovalRoundSchema } from '@/src/schemas/sd-approval-round.schema'
import { SdApprovalRoundService } from '@/src/services/sd-approval-round.service'

/** Rodadas de aprovação do comitê (CAB) do chamado. Só agentes. */
export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdApprovalRoundService.list(userId, params.id, params.ticketId),
})

export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/tickets/[ticketId]/approval-rounds',
  body: OpenSdApprovalRoundSchema,
  allowEmptyBody: true,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdApprovalRoundService.open(userId, params.id, params.ticketId, body),
})
