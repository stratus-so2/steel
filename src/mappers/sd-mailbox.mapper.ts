import type { SdMailMessage } from '@prisma/client'
import type { SdMailboxRow } from '@/src/repositories/sd-mailbox.repository'
import type { SdMailboxDTO, SdTicketMailMessageDTO } from '@/types/sd-mailbox'

/**
 * `SdMailbox`/`SdMailMessage` → DTO. As senhas cifradas nunca saem: só o
 * sinal `smtpConfigured` diz se a caixa envia pelo próprio SMTP.
 */
export function toSdMailboxDTO(row: SdMailboxRow): SdMailboxDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    address: row.address,
    status: row.status,
    statusError: row.statusError,
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    imapSecure: row.imapSecure,
    imapUser: row.imapUser,
    folder: row.folder,
    processedFolder: row.processedFolder,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    smtpConfigured: Boolean(row.smtpHost && row.encryptedSmtpPassword),
    defaultType: row.defaultType,
    defaultDepartmentId: row.defaultDepartmentId,
    defaultCategoryId: row.defaultCategoryId,
    defaultPriorityId: row.defaultPriorityId,
    allowedSenders: row.allowedSenders,
    blockedSenders: row.blockedSenders,
    createUnknownContacts: row.createUnknownContacts,
    sendAcknowledgement: row.sendAcknowledgement,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSeenUid: row.lastSeenUid,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSdTicketMailMessageDTO(
  row: SdMailMessage,
): SdTicketMailMessageDTO {
  return {
    id: row.id,
    ticketMessageId: row.ticketMessageId,
    direction: row.direction,
    fromAddress: row.fromAddress,
    fromName: row.fromName,
    toAddresses: row.toAddresses,
    ccAddresses: row.ccAddresses,
    subject: row.subject,
    automatic: row.automatic,
    createdAt: row.createdAt.toISOString(),
  }
}
