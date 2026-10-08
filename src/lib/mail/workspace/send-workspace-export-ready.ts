import {
  WorkspaceExportReady,
  type WorkspaceExportReadyEmailProps,
} from '@/components/emails/workspace/workspace-export-ready'
import { sendEmail } from '../send'

/** Ajustes › Exportações: tells the requester the file is ready. */
export async function sendWorkspaceExportReadyEmail(
  props: WorkspaceExportReadyEmailProps,
) {
  return sendEmail({
    to: [props.email],
    subject: `Exportação de ${props.kindLabel} de ${props.workspaceName} pronta`,
    react: WorkspaceExportReady(props),
  })
}
