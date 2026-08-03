import {
  ChangelogEmail,
  type ChangelogEmailItem,
} from '@/components/emails/admin/changelog'
import { sendEmail } from '../send'
import { mailSenders } from '../senders'

export async function sendChangelogEmail({
  email,
  subject,
  items,
}: {
  email: string
  subject: string
  items: ChangelogEmailItem[]
}) {
  return sendEmail({
    to: [email],
    from: mailSenders.notifications,
    subject,
    react: ChangelogEmail({ subject, items }),
  })
}
