import { CrmProposalExpired } from '@/components/emails/crm/proposal-expired'
import type { CrmProposalExpiredEmailProps } from '@/types/mail'
import { sendEmail } from '../send'

/** Avisa o responsável que a proposta expirou sem resposta do cliente. */
export async function sendCrmProposalExpiredEmail(
  props: CrmProposalExpiredEmailProps,
) {
  return sendEmail({
    to: [props.email],
    subject: `A proposta ${props.proposalName} expirou`,
    react: CrmProposalExpired(props),
  })
}
