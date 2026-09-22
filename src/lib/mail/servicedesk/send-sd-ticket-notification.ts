import {
  SdTicketNotification,
  type SdTicketNotificationEmailProps,
} from '@/components/emails/servicedesk/sd-ticket-notification'
import { sendEmail } from '../send'

export async function sendSdTicketNotificationEmail(
  props: SdTicketNotificationEmailProps,
) {
  return sendEmail({
    to: [props.email],
    subject: `${props.ticketCode} — ${props.headline}`,
    react: SdTicketNotification(props),
  })
}
