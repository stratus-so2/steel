import { WhatsAppSentimentAlert } from '@/components/emails/workspace/whatsapp-sentiment-alert'
import type { WhatsAppSentimentAlertEmailProps } from '@/types/mail'
import { sendEmail } from '../send'

export async function sendWhatsAppSentimentAlertEmail(
  props: WhatsAppSentimentAlertEmailProps,
) {
  return sendEmail({
    to: [props.email],
    subject: `Conversa com sentimento negativo: ${props.contactLabel}`,
    react: WhatsAppSentimentAlert(props),
  })
}
