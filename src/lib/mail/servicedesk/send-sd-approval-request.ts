import {
  SdApprovalRequest,
  type SdApprovalRequestEmailProps,
} from '@/components/emails/servicedesk/sd-approval-request'
import { sendEmail } from '../send'

export async function sendSdApprovalRequestEmail(
  props: SdApprovalRequestEmailProps,
) {
  return sendEmail({
    to: [props.email],
    subject: `${props.ticketCode} — aprovação solicitada`,
    react: SdApprovalRequest(props),
  })
}
