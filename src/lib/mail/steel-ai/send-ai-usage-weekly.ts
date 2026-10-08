import { formatRange } from '@/app/_components/steel-ai-usage/usage-format'
import {
  AiUsageWeekly,
  type AiUsageWeeklyEmailProps,
} from '@/components/emails/steel-ai/ai-usage-weekly'
import { sendEmail } from '../send'

/** Subject of the weekly Steel AI usage e-mail. */
export function aiUsageWeeklySubject(
  props: Pick<AiUsageWeeklyEmailProps, 'workspaceName' | 'report'>,
): string {
  return `Consumo do Steel AI em ${props.workspaceName} — semana ${formatRange(props.report.weekStart, props.report.weekEnd)}`
}

/**
 * Weekly Steel AI usage summary to one workspace owner. `sendEmail` honours
 * `MAIL_DRY_RUN` (and test recipients): nothing reaches Resend then.
 */
export async function sendAiUsageWeeklyEmail(props: AiUsageWeeklyEmailProps) {
  return sendEmail({
    to: [props.email],
    subject: aiUsageWeeklySubject(props),
    react: AiUsageWeekly(props),
  })
}
