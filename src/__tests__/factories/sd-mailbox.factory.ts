import { createId } from '@paralleldrive/cuid2'
import type { Prisma, SdMailMessage } from '@prisma/client'
import type { SdFetchedMail } from '@/src/lib/mail/sd-mailbox-transport'
import { prisma } from '@/src/lib/prisma'
import type { SdMailboxRow } from '@/src/repositories/sd-mailbox.repository'

/**
 * Fábricas do canal de e-mail do ServiceDesk: fakes para os testes
 * unitários (caixa, `SdMailMessage` e a mensagem já lida do IMAP) e seeds
 * no banco para os de integração.
 */

const fixed = () => new Date('2026-10-01T12:00:00.000Z')

export function createFakeSdMailbox(
  overrides?: Partial<SdMailboxRow>,
): SdMailboxRow {
  return {
    id: 'mb1',
    workspaceId: 'ws1',
    name: 'Suporte',
    address: 'suporte@empresa.com.br',
    protocol: 'IMAP',
    status: 'ACTIVE',
    statusError: null,
    imapHost: 'imap.empresa.com.br',
    imapPort: 993,
    imapSecure: true,
    imapUser: 'suporte@empresa.com.br',
    encryptedImapPassword: 'enc:imap',
    folder: 'INBOX',
    processedFolder: null,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: true,
    smtpUser: null,
    encryptedSmtpPassword: null,
    defaultType: 'INCIDENT',
    defaultDepartmentId: null,
    defaultCategoryId: null,
    defaultPriorityId: null,
    allowedSenders: [],
    blockedSenders: [],
    createUnknownContacts: true,
    sendAcknowledgement: true,
    lastSyncAt: null,
    lastSeenUid: null,
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeSdMailMessage(
  overrides?: Partial<SdMailMessage>,
): SdMailMessage {
  return {
    id: createId(),
    workspaceId: 'ws1',
    mailboxId: 'mb1',
    ticketId: null,
    ticketMessageId: null,
    messageId: '<abc@cliente.com>',
    inReplyTo: null,
    references: [],
    direction: 'INBOUND',
    fromAddress: 'cliente@cliente.com',
    fromName: 'Cliente',
    toAddresses: ['suporte@empresa.com.br'],
    ccAddresses: [],
    subject: 'Impressora parada',
    bodyText: 'A impressora do 3º andar não liga.',
    automatic: false,
    processedAt: fixed(),
    error: null,
    createdAt: fixed(),
    ...overrides,
  }
}

/** Mensagem já lida e parseada do IMAP (entrada do `SdMailInboundService`). */
export function createFakeFetchedMail(
  overrides?: Partial<SdFetchedMail>,
): SdFetchedMail {
  return {
    uid: 10,
    messageId: '<abc@cliente.com>',
    inReplyTo: null,
    references: [],
    fromAddress: 'cliente@cliente.com',
    fromName: 'Cliente Silva',
    toAddresses: ['suporte@empresa.com.br'],
    ccAddresses: [],
    subject: 'Impressora parada',
    text: 'A impressora do 3º andar não liga.',
    html: null,
    date: fixed(),
    headers: {},
    attachments: [],
    ...overrides,
  }
}

/* --------------------------- seeds (integration) -------------------------- */

export async function seedSdMailbox(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdMailboxUncheckedCreateInput>,
) {
  return prisma.sdMailbox.create({
    data: {
      workspaceId,
      createdById,
      name: 'Suporte',
      address: `suporte-${createId()}@empresa.com.br`,
      imapHost: 'imap.empresa.com.br',
      imapUser: 'suporte',
      encryptedImapPassword: 'enc:imap',
      ...overrides,
    },
  })
}

export async function seedSdMailMessage(
  workspaceId: string,
  mailboxId: string,
  overrides?: Partial<Prisma.SdMailMessageUncheckedCreateInput>,
) {
  return prisma.sdMailMessage.create({
    data: {
      workspaceId,
      mailboxId,
      messageId: `<${createId()}@cliente.com>`,
      direction: 'INBOUND',
      fromAddress: 'cliente@cliente.com',
      ...overrides,
    },
  })
}
