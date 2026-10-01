import { sdMailboxConnectionFailed } from '@/src/errors'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { err, ok, type Result } from '@/src/lib/result'
import type {
  SdImapConfig,
  SdSmtpConfig,
} from '@/src/lib/servicedesk/mail-transport'
import type { SdMailboxRow } from '@/src/repositories/sd-mailbox.repository'

/**
 * Decifra as credenciais da caixa (`CONNECTION_SECRETS`) e monta a
 * configuração de IMAP/SMTP. Uma chave trocada ou um envelope corrompido
 * viram `SD_MAILBOX_CONNECTION_FAILED` em vez de exceção.
 */
export interface SdMailboxCredentials {
  imap: SdImapConfig
  /** `null` quando a caixa não tem SMTP próprio (envia pela camada do Steel). */
  smtp: SdSmtpConfig | null
}

export async function decryptSdMailbox(
  mailbox: SdMailboxRow,
): Promise<Result<SdMailboxCredentials>> {
  try {
    const imapPassword = await decryptConnectionSecret(
      mailbox.encryptedImapPassword,
    )
    const imap: SdImapConfig = {
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.imapSecure,
      user: mailbox.imapUser,
      password: imapPassword,
      folder: mailbox.folder,
    }

    if (!mailbox.smtpHost || !mailbox.encryptedSmtpPassword) {
      return ok({ imap, smtp: null })
    }

    const smtpPassword = await decryptConnectionSecret(
      mailbox.encryptedSmtpPassword,
    )
    return ok({
      imap,
      smtp: {
        host: mailbox.smtpHost,
        port: mailbox.smtpPort ?? (mailbox.smtpSecure ? 465 : 587),
        secure: mailbox.smtpSecure,
        user: mailbox.smtpUser ?? mailbox.imapUser,
        password: smtpPassword,
      },
    })
  } catch {
    return err(
      sdMailboxConnectionFailed(
        'Não foi possível ler as credenciais da caixa de e-mail',
      ),
    )
  }
}
