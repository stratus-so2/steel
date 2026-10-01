import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdApprovalRoundService } from '@/src/services/sd-approval-round.service'

/** Cancela a rodada aberta e os pedidos que ainda não responderam. */
export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/tickets/[ticketId]/approval-rounds/[roundId]',
  handler: ({ userId, params }) =>
    SdApprovalRoundService.cancel(
      userId,
      params.id,
      params.ticketId,
      params.roundId,
    ),
})
