import type {
  Prisma,
  SdAttachmentKind,
  SdMailboxStatus,
  SdMailDirection,
  SdMailMessage,
  SdMessageAuthorKind,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { ok, type Result } from '@/src/lib/result'
import { sdDb } from './sd-config-db'

/**
 * Acesso a dados do canal de e-mail do ServiceDesk: as caixas monitoradas
 * (`SdMailbox`) e o registro de cada mensagem trocada (`SdMailMessage`).
 * As linhas do histórico do chamado (`SdTicketMessage`/`SdTicketAttachment`)
 * são da fatia ticket-tabs — aqui só as que o e-mail cria, com autor de
 * sistema (`uploadedById` nulo), igual ao espelho do WhatsApp.
 */

export type SdMailboxRow = Prisma.SdMailboxGetPayload<object>

export interface SdMailboxCreateData {
  workspaceId: string
  createdById: string
  name: string
  address: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  imapUser: string
  encryptedImapPassword: string
  folder: string
  processedFolder: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUser: string | null
  encryptedSmtpPassword: string | null
  defaultType: Prisma.SdMailboxCreateInput['defaultType']
  defaultDepartmentId: string | null
  defaultCategoryId: string | null
  defaultPriorityId: string | null
  allowedSenders: string[]
  blockedSenders: string[]
  createUnknownContacts: boolean
  sendAcknowledgement: boolean
}

const CONFLICT = 'Já existe uma caixa com este endereço'

export const SdMailboxRepository = {
  async listByWorkspace(workspaceId: string): Promise<Result<SdMailboxRow[]>> {
    return sdDb('Failed to list ServiceDesk mailboxes', () =>
      prisma.sdMailbox.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: [{ createdAt: 'asc' }],
      }),
    )
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdMailboxRow | null>> {
    return sdDb('Failed to find ServiceDesk mailbox', () =>
      prisma.sdMailbox.findFirst({
        where: { id, workspaceId, deletedAt: null },
      }),
    )
  },

  /** Caixa com este endereço, inclusive a excluída (revive no lugar). */
  async findByAddress(
    workspaceId: string,
    address: string,
  ): Promise<Result<SdMailboxRow | null>> {
    return sdDb('Failed to find ServiceDesk mailbox', () =>
      prisma.sdMailbox.findFirst({ where: { workspaceId, address } }),
    )
  },

  /** Sem escopo de workspace: o worker recebe só o id da caixa. */
  async findByIdUnscoped(id: string): Promise<Result<SdMailboxRow | null>> {
    return sdDb('Failed to find ServiceDesk mailbox', () =>
      prisma.sdMailbox.findFirst({ where: { id, deletedAt: null } }),
    )
  },

  /** Caixas que o tick do worker deve ler (pausadas ficam de fora). */
  async listPollable(limit: number): Promise<Result<SdMailboxRow[]>> {
    return sdDb('Failed to list pollable ServiceDesk mailboxes', () =>
      prisma.sdMailbox.findMany({
        where: { deletedAt: null, status: { in: ['ACTIVE', 'ERROR'] } },
        orderBy: [{ lastSyncAt: { sort: 'asc', nulls: 'first' } }],
        take: limit,
      }),
    )
  },

  async create(data: SdMailboxCreateData): Promise<Result<SdMailboxRow>> {
    return sdDb(
      'Failed to create ServiceDesk mailbox',
      () => prisma.sdMailbox.create({ data }),
      CONFLICT,
    )
  },

  async update(
    id: string,
    data: Prisma.SdMailboxUpdateInput,
  ): Promise<Result<SdMailboxRow>> {
    return sdDb(
      'Failed to update ServiceDesk mailbox',
      () => prisma.sdMailbox.update({ where: { id }, data }),
      CONFLICT,
    )
  },

  async softDelete(id: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk mailbox', async () => {
      await prisma.sdMailbox.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'PAUSED' },
      })
    })
  },

  /** Resultado da leitura: status, erro, último UID e horário. */
  async markSync(
    id: string,
    data: {
      status: SdMailboxStatus
      statusError: string | null
      lastSeenUid?: number | null
      lastSyncAt: Date
    },
  ): Promise<Result<void>> {
    return sdDb('Failed to update ServiceDesk mailbox sync', async () => {
      await prisma.sdMailbox.update({
        where: { id },
        data: {
          status: data.status,
          statusError: data.statusError,
          lastSyncAt: data.lastSyncAt,
          ...(data.lastSeenUid === undefined
            ? {}
            : { lastSeenUid: data.lastSeenUid }),
        },
      })
    })
  },
}

export interface SdMailMessageCreateData {
  workspaceId: string
  mailboxId: string
  ticketId: string | null
  ticketMessageId?: string | null
  messageId: string
  inReplyTo: string | null
  references: string[]
  direction: SdMailDirection
  fromAddress: string
  fromName: string | null
  toAddresses: string[]
  ccAddresses: string[]
  subject: string | null
  bodyText: string | null
  automatic: boolean
  processedAt: Date | null
  error: string | null
}

export interface SdMailTicketMessageInput {
  workspaceId: string
  ticketId: string
  authorKind: SdMessageAuthorKind
  authorUserId?: string | null
  authorContactId?: string | null
  body: string
  attachments: {
    id: string
    kind: SdAttachmentKind
    fileName: string
    mimeType: string
    size: number
    storageKey: string
  }[]
}

export const SdMailMessageRepository = {
  /** Já processamos esta mensagem nesta caixa? (dedupe do `Message-ID`). */
  async findByMessageId(
    mailboxId: string,
    messageId: string,
  ): Promise<Result<SdMailMessage | null>> {
    return sdDb('Failed to find ServiceDesk mail message', () =>
      prisma.sdMailMessage.findUnique({
        where: { mailboxId_messageId: { mailboxId, messageId } },
      }),
    )
  },

  /**
   * Primeiro e-mail já registrado no workspace cujo `Message-ID` esteja em
   * `messageIds` **e** que tenha chamado: é o chamado da thread.
   */
  async findThreadTicketId(
    workspaceId: string,
    messageIds: string[],
  ): Promise<Result<string | null>> {
    if (messageIds.length === 0) return ok(null)
    return sdDb('Failed to resolve ServiceDesk mail thread', async () => {
      const row = await prisma.sdMailMessage.findFirst({
        where: {
          workspaceId,
          messageId: { in: messageIds },
          ticketId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { ticketId: true },
      })
      return row?.ticketId ?? null
    })
  },

  async create(data: SdMailMessageCreateData): Promise<Result<SdMailMessage>> {
    return sdDb(
      'Failed to create ServiceDesk mail message',
      () => prisma.sdMailMessage.create({ data }),
      'Esta mensagem já foi registrada',
    )
  },

  /** E-mails de um chamado (marcador da aba Histórico). */
  async listByTicket(ticketId: string): Promise<Result<SdMailMessage[]>> {
    return sdDb('Failed to list ServiceDesk mail messages', () =>
      prisma.sdMailMessage.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        take: 500,
      }),
    )
  },

  /** Quantos e-mails a caixa recebeu desde `since` (limite por caixa). */
  async countInboundSince(
    mailboxId: string,
    since: Date,
  ): Promise<Result<number>> {
    return sdDb('Failed to count ServiceDesk mail messages', () =>
      prisma.sdMailMessage.count({
        where: { mailboxId, direction: 'INBOUND', createdAt: { gte: since } },
      }),
    )
  },

  /** Já mandamos e-mail para esta mensagem do histórico? (anti-duplicata). */
  async hasOutboundFor(ticketMessageId: string): Promise<Result<boolean>> {
    return sdDb('Failed to check ServiceDesk outbound mail', async () => {
      const count = await prisma.sdMailMessage.count({
        where: { ticketMessageId, direction: 'OUTBOUND' },
      })
      return count > 0
    })
  },

  /** Caixa que atende um chamado: a do e-mail mais recente dele. */
  async findMailboxIdForTicket(
    ticketId: string,
  ): Promise<Result<string | null>> {
    return sdDb('Failed to find ServiceDesk mailbox of ticket', async () => {
      const row = await prisma.sdMailMessage.findFirst({
        where: { ticketId },
        orderBy: { createdAt: 'desc' },
        select: { mailboxId: true },
      })
      return row?.mailboxId ?? null
    })
  },

  /**
   * Último e-mail recebido do chamado: dá o `Message-ID` que a resposta
   * referencia (`In-Reply-To`) e o assunto original.
   */
  async findLastInbound(
    ticketId: string,
  ): Promise<Result<SdMailMessage | null>> {
    return sdDb('Failed to find ServiceDesk inbound mail', () =>
      prisma.sdMailMessage.findFirst({
        where: { ticketId, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
      }),
    )
  },

  /** Mensagem no histórico do chamado + anexos, numa transação. */
  async createTicketMessage(
    input: SdMailTicketMessageInput,
  ): Promise<Result<{ id: string }>> {
    return sdDb('Failed to create ServiceDesk mail ticket message', () =>
      prisma.$transaction(async (tx) => {
        const message = await tx.sdTicketMessage.create({
          data: {
            workspaceId: input.workspaceId,
            ticketId: input.ticketId,
            authorKind: input.authorKind,
            authorUserId: input.authorUserId ?? null,
            authorContactId: input.authorContactId ?? null,
            visibility: 'PUBLIC',
            channel: 'EMAIL',
            body: input.body,
          },
          select: { id: true },
        })
        for (const attachment of input.attachments) {
          await tx.sdTicketAttachment.create({
            data: {
              id: attachment.id,
              workspaceId: input.workspaceId,
              ticketId: input.ticketId,
              messageId: message.id,
              uploadedById: null,
              kind: attachment.kind,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              size: attachment.size,
              storageKey: attachment.storageKey,
            },
          })
        }
        return message
      }),
    )
  },

  /** Contato do workspace pelo e-mail, para o autor da mensagem. */
  async findContactIdByEmail(
    workspaceId: string,
    email: string,
  ): Promise<Result<{ id: string; userId: string | null } | null>> {
    return sdDb('Failed to find ServiceDesk contact by email', () =>
      prisma.sdContact.findFirst({
        where: {
          workspaceId,
          deletedAt: null,
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true, userId: true },
      }),
    )
  },

  /** Chamado do workspace pelo número (código no assunto). */
  async findTicketIdByNumber(
    workspaceId: string,
    number: number,
  ): Promise<Result<string | null>> {
    return sdDb('Failed to find ServiceDesk ticket by number', async () => {
      const row = await prisma.sdTicket.findFirst({
        where: { workspaceId, number, deletedAt: null },
        select: { id: true },
      })
      return row?.id ?? null
    })
  },
}
