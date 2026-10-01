import {
  SdDailyDigest,
  type SdDailyDigestEmailProps,
} from '@/components/emails/servicedesk/sd-daily-digest'
import { sendEmail } from '../send'

export async function sendSdDailyDigestEmail(props: SdDailyDigestEmailProps) {
  return sendEmail({
    to: [props.email],
    subject: `Resumo do ServiceDesk — ${props.queue} chamado(s) na sua fila`,
    react: SdDailyDigest(props),
  })
}
