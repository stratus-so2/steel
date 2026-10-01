import { z } from 'zod'
import { dto } from '../../common'
import { SdUserSummaryDTO } from '../servicedesk-tickets'

/**
 * DTOs das abas do chamado do ServiceDesk (`types/sd-ticket-{message,task,
 * cost,part,approval,signature}.d.ts`).
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()
const money = (example: string) =>
  z.string().meta({ description: 'Decimal com 2 casas.', example })
const User = SdUserSummaryDTO.nullable()

/* ------------------------------ histórico ------------------------------ */

export const SdTicketAttachmentDTO = dto(
  'SdTicketAttachment',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    messageId: z
      .string()
      .nullable()
      .meta({ description: '`null` = enviado e ainda não preso a mensagem.' }),
    kind: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER']),
    fileName: z.string().meta({ example: 'print-erro.png' }),
    mimeType: z.string().meta({ example: 'image/png' }),
    size: z.number().int().meta({ description: 'Bytes.' }),
    uploadedBy: User,
    url: z.string().meta({
      description:
        'Rota autenticada que serve o arquivo (`?download=1` força o download).',
    }),
    createdAt: dateTime(),
  }),
)

export const SdTicketMessageDTO = dto(
  'SdTicketMessage',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    authorKind: z.enum(['AGENT', 'REQUESTER', 'CONTACT', 'AI', 'SYSTEM']),
    author: User,
    contact: z.object({ id: z.string(), name: z.string() }).nullable(),
    visibility: z.enum(['PUBLIC', 'INTERNAL']).meta({
      description: '`INTERNAL` = nota interna (só agentes).',
    }),
    channel: z.enum(['PLATFORM', 'WHATSAPP', 'EMAIL']),
    body: z
      .string()
      .meta({ example: 'Reiniciamos o serviço, pode testar? 🙂' }),
    attachments: z.array(SdTicketAttachmentDTO),
    mentionedUserIds: z.array(z.string()).meta({
      description: 'Agentes citados com `@` nesta mensagem.',
    }),
    editedAt: nullableDateTime(),
    createdAt: dateTime(),
    canEdit: z.boolean().meta({
      description: 'O usuário atual é o autor e está na janela de 15 minutos.',
    }),
    editableUntil: nullableDateTime(),
  }),
)

export const SdTicketMessagePageDTO = dto(
  'SdTicketMessagePage',
  z.object({
    items: z
      .array(SdTicketMessageDTO)
      .meta({ description: 'Ordem cronológica (mais antigas primeiro).' }),
    nextBefore: z.string().nullable().meta({
      description: 'Id para `?before=` (mais antigas); `null` = início.',
    }),
  }),
)

/* ------------------------------- tarefas ------------------------------- */

export const SdTicketTaskDTO = dto(
  'SdTicketTask',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    title: z.string().meta({ example: 'Trocar o switch do rack 2' }),
    description: z.string().nullable(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELED']),
    assignee: User,
    dueDate: nullableDateTime(),
    completedAt: nullableDateTime(),
    position: z.number().int(),
    overdue: z.boolean().meta({ description: 'Prazo vencido e ainda aberta.' }),
    createdBy: User,
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdTicketTaskListDTO = dto(
  'SdTicketTaskList',
  z.object({
    items: z.array(SdTicketTaskDTO),
    progress: z.object({
      done: z.number().int(),
      total: z.number().int().meta({ description: 'Sem as canceladas.' }),
      percent: z.number().int(),
    }),
  }),
)

/* -------------------------------- custos ------------------------------- */

const CostCategory = z.enum([
  'LABOR',
  'TRAVEL',
  'MATERIAL',
  'SERVICE',
  'LICENSE',
  'OTHER',
])

export const SdTicketCostDTO = dto(
  'SdTicketCost',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    category: CostCategory,
    description: z.string().meta({ example: 'Visita técnica' }),
    quantity: money('1.50'),
    unitCost: money('150.00'),
    total: money('225.00'),
    billable: z.boolean(),
    incurredAt: dateTime(),
    user: User,
    createdBy: User,
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdTicketCostListDTO = dto(
  'SdTicketCostList',
  z.object({
    items: z.array(SdTicketCostDTO),
    summary: z.object({
      total: money('225.00'),
      billable: money('225.00'),
      nonBillable: money('0.00'),
      byCategory: z.array(
        z.object({ category: CostCategory, total: money('225.00') }),
      ),
    }),
  }),
)

/* -------------------------------- peças -------------------------------- */

const PartStatus = z.enum([
  'REQUESTED',
  'RESERVED',
  'INSTALLED',
  'RETURNED',
  'CANCELED',
])

export const SdTicketPartDTO = dto(
  'SdTicketPart',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    partId: z.string().nullable(),
    name: z.string().meta({ example: 'Fonte ATX 500W' }),
    sku: z.string().nullable(),
    quantity: z.number().int(),
    unitCost: money('199.90'),
    total: money('199.90'),
    serialNumber: z.string().nullable(),
    status: PartStatus,
    notes: z.string().nullable(),
    catalogStock: z
      .number()
      .int()
      .nullable()
      .meta({ description: 'Estoque atual (`null` = não controlado).' }),
    nextStatuses: z.array(PartStatus),
    createdBy: User,
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdTicketPartListDTO = dto(
  'SdTicketPartList',
  z.object({
    items: z.array(SdTicketPartDTO),
    summary: z.object({
      total: money('199.90'),
      installed: money('199.90'),
      count: z.number().int(),
    }),
  }),
)

/* ------------------------------ aprovações ----------------------------- */

const ApprovalStatus = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELED',
  'EXPIRED',
])

export const SdTicketApprovalDTO = dto(
  'SdTicketApproval',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    approverName: z.string().nullable(),
    approverEmail: z.string().meta({ example: 'gestor@example.com' }),
    approver: User,
    status: ApprovalStatus,
    message: z.string().nullable(),
    comment: z.string().nullable(),
    requestedBy: User,
    sentAt: nullableDateTime(),
    respondedAt: nullableDateTime(),
    expiresAt: dateTime(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdPublicApprovalDTO = dto(
  'SdPublicApproval',
  z.object({
    status: ApprovalStatus,
    workspaceName: z.string(),
    approverName: z.string().nullable(),
    requestedByName: z.string().nullable(),
    message: z.string().nullable(),
    comment: z.string().nullable(),
    expiresAt: dateTime(),
    respondedAt: nullableDateTime(),
    ticket: z.object({
      code: z.string().meta({ example: 'CHG-000045' }),
      title: z.string(),
      type: z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM']),
      phaseName: z.string(),
      summary: z
        .string()
        .nullable()
        .meta({ description: 'Descrição em texto puro, truncada.' }),
    }),
  }),
)

/* ------------------------------ assinaturas ---------------------------- */

const sha = () => z.string().meta({ description: 'SHA-256 (hex).' })

export const SdTicketSignatureDTO = dto(
  'SdTicketSignature',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    purpose: z.string().meta({ example: 'Aceite do atendimento' }),
    signerName: z.string(),
    signerDocument: z.string().nullable(),
    signerEmail: z.string().nullable(),
    signedBy: User,
    imageUrl: z.string().meta({ description: 'Rota autenticada do PNG.' }),
    imageSha256: sha(),
    ticketSha256: sha(),
    signedAt: dateTime(),
  }),
)

export const SdTicketSignatureVerificationDTO = dto(
  'SdTicketSignatureVerification',
  z.object({
    signatureId: z.string(),
    imageIntact: z.boolean(),
    storedImageSha256: sha(),
    computedImageSha256: sha()
      .nullable()
      .meta({ description: '`null` = arquivo não encontrado.' }),
    ticketUnchanged: z.boolean(),
    signedTicketSha256: sha(),
    currentTicketSha256: sha(),
    verifiedAt: dateTime(),
  }),
)
