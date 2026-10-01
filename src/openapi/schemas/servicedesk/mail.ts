import { z } from 'zod'
import { dto } from '../../common'

/** DTOs do canal de e-mail do ServiceDesk (`types/sd-mailbox.d.ts`). */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const MailboxStatus = z.enum(['ACTIVE', 'ERROR', 'PAUSED'])
const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])

export const SdMailboxDTO = dto(
  'SdMailbox',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string().meta({ example: 'Suporte' }),
    address: z.email().meta({ example: 'suporte@empresa.com.br' }),
    status: MailboxStatus,
    statusError: z.string().nullable(),
    imapHost: z.string().meta({ example: 'imap.empresa.com.br' }),
    imapPort: z.number().int().meta({ example: 993 }),
    imapSecure: z.boolean(),
    imapUser: z.string(),
    folder: z.string().meta({ example: 'INBOX' }),
    processedFolder: z.string().nullable().meta({
      description:
        'Pasta para onde a mensagem é movida depois de processada (vazio = fica onde está).',
    }),
    smtpHost: z.string().nullable(),
    smtpPort: z.number().int().nullable(),
    smtpSecure: z.boolean(),
    smtpUser: z.string().nullable(),
    smtpConfigured: z.boolean().meta({
      description:
        'Há senha de SMTP guardada: a resposta sai pela própria caixa. Sem isto, sai pela camada de e-mail do Steel com `Reply-To` da caixa.',
    }),
    defaultType: TicketType,
    defaultDepartmentId: z.string().nullable(),
    defaultCategoryId: z.string().nullable(),
    defaultPriorityId: z.string().nullable(),
    allowedSenders: z.array(z.string()).meta({
      description:
        'E-mails ou domínios (`@empresa.com.br`) aceitos. Vazio aceita qualquer remetente.',
    }),
    blockedSenders: z.array(z.string()).meta({
      description: 'Tem precedência sobre `allowedSenders`.',
    }),
    createUnknownContacts: z.boolean(),
    sendAcknowledgement: z.boolean(),
    lastSyncAt: nullableDateTime(),
    lastSeenUid: z.number().int().nullable().meta({
      description: 'Último UID IMAP já processado na pasta monitorada.',
    }),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdMailboxTestDTO = dto(
  'SdMailboxTest',
  z.object({
    connected: z.boolean(),
    status: MailboxStatus,
    error: z.string().nullable(),
    messages: z.number().int().nullable().meta({
      description: 'Mensagens na pasta monitorada (`null` se o IMAP falhou).',
    }),
    smtp: z.boolean().nullable().meta({
      description: '`null` quando a caixa não tem SMTP configurado.',
    }),
  }),
)

export const SdMailboxSyncDTO = dto(
  'SdMailboxSync',
  z.object({
    fetched: z.number().int(),
    opened: z.number().int(),
    appended: z.number().int(),
    skipped: z.number().int(),
    failed: z.number().int(),
  }),
)

export const SdTicketMailMessageDTO = dto(
  'SdTicketMailMessage',
  z.object({
    id: z.string(),
    ticketMessageId: z.string().nullable().meta({
      description:
        'Mensagem do histórico (`SdTicketMessage`) gerada por este e-mail.',
    }),
    direction: z.enum(['INBOUND', 'OUTBOUND']),
    fromAddress: z.email(),
    fromName: z.string().nullable(),
    toAddresses: z.array(z.email()),
    ccAddresses: z.array(z.email()),
    subject: z.string().nullable(),
    automatic: z.boolean().meta({
      description:
        'Resposta automática/devolução: fica registrada, mas não abre nem reabre chamado.',
    }),
    createdAt: dateTime(),
  }),
)
