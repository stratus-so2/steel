import {
  SdKbReview,
  type SdKbReviewEmailProps,
} from '@/components/emails/servicedesk/sd-kb-review'
import { sendEmail } from '../send'

export async function sendSdKbReviewEmail(props: SdKbReviewEmailProps) {
  return sendEmail({
    to: [props.email],
    subject: `${props.headline} — ${props.articleTitle}`,
    react: SdKbReview(props),
  })
}
