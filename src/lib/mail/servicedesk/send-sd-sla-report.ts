import {
  SdSlaReport,
  type SdSlaReportEmailProps,
} from '@/components/emails/servicedesk/sd-sla-report'
import { sendEmail } from '../send'

export interface SdSlaReportAttachment {
  filename: string
  content: Buffer
}

/**
 * Manda o relatório de SLA para **um** destinatário (o chamador itera: cada
 * e-mail é independente, então uma falha não derruba a lista). Os arquivos
 * vão anexos; quando passam do limite, o corpo manda o link do histórico.
 * `MAIL_DRY_RUN` e os domínios de teste são tratados em `sendEmail`.
 */
export async function sendSdSlaReportEmail(
  props: SdSlaReportEmailProps & { attachments?: SdSlaReportAttachment[] },
) {
  const { attachments, ...email } = props
  return sendEmail({
    to: [email.email],
    subject: `${email.reportName} — ${email.periodLabel}`,
    react: SdSlaReport(email),
    ...(attachments && attachments.length > 0
      ? {
          attachments: attachments.map((file) => ({
            filename: file.filename,
            content: file.content,
          })),
        }
      : {}),
  })
}
