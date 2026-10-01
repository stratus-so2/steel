import {
  SdPortalAccess,
  type SdPortalAccessEmailProps,
} from '@/components/emails/servicedesk/sd-portal-access'
import { sendEmail } from '../send'

/** Link mágico do portal de atendimento (respeita `MAIL_DRY_RUN`). */
export async function sendSdPortalAccessEmail(props: SdPortalAccessEmailProps) {
  return sendEmail({
    to: [props.email],
    subject: `Seu acesso ao portal de atendimento — ${props.workspaceName}`,
    react: SdPortalAccess(props),
  })
}
