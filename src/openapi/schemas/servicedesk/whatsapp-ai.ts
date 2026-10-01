import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs do WhatsApp e do agente de IA do ServiceDesk (`types/sd-whatsapp.d.ts`
 * e `types/sd-ai.d.ts`).
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const Provider = z.enum(['ZAPI', 'META'])
const ConnectionStatus = z.enum([
  'DISCONNECTED',
  'CONNECTING',
  'CONNECTED',
  'ERROR',
])

/* ------------------------------- conexões -------------------------------- */

export const SdWhatsappConnectionDTO = dto(
  'SdWhatsappConnection',
  z.object({
    id: z.string(),
    provider: Provider,
    label: z.string().meta({ example: 'Suporte TI' }),
    phoneNumber: z.string().meta({ example: '5511988887777' }),
    status: ConnectionStatus,
    statusError: z.string().nullable(),
    zapiInstanceId: z.string().nullable(),
    metaPhoneNumberId: z.string().nullable(),
    metaWabaId: z.string().nullable(),
    active: z.boolean().meta({
      description:
        'É a conexão ativa do ServiceDesk (`SdSettings.whatsappConnectionId`).',
    }),
    webhookPath: z.string().meta({
      description:
        'Caminho do webhook a configurar no provedor (sem o domínio). Z-API inclui `?secret=`; Meta é a URL única da plataforma.',
      example: '/api/whatsapp/webhook/zapi?secret=abc123',
    }),
    createdAt: dateTime(),
  }),
)

export const SdWhatsappConnectionTestDTO = dto(
  'SdWhatsappConnectionTest',
  z.object({
    connected: z.boolean(),
    status: ConnectionStatus,
    error: z.string().nullable(),
  }),
)

export const SdWhatsappQrCodeDTO = dto(
  'SdWhatsappQrCode',
  z.object({
    status: z.enum(['connected', 'awaiting_scan']),
    qrCodeBase64: z.string().optional().meta({
      description:
        'Imagem do QR code (data URI ou base64), enquanto não pareou.',
    }),
  }),
)

/* ------------------------------- conversas ------------------------------- */

export const SdWhatsappConversationDTO = dto(
  'SdWhatsappConversation',
  z.object({
    id: z.string(),
    connectionId: z.string(),
    contact: z.object({
      id: z.string(),
      name: z.string().nullable(),
      waId: z.string().meta({ example: '5511999998888' }),
      avatarUrl: z.string().nullable(),
    }),
    status: z.enum(['NEW', 'IN_PROGRESS', 'CLOSED']),
    aiActive: z.boolean().meta({
      description: 'A IA do ServiceDesk está atendendo esta conversa.',
    }),
    aiHandoff: z.boolean().meta({
      description: 'Transbordo para humano — a IA não responde mais aqui.',
    }),
    lastMessageAt: nullableDateTime(),
    lastMessagePreview: z.string().nullable(),
    openTicket: z
      .object({
        id: z.string(),
        number: z.number().int(),
        code: z.string().meta({ example: 'INC-000123' }),
      })
      .nullable()
      .meta({ description: 'Chamado em aberto já vinculado à conversa.' }),
  }),
)

export const SdWhatsappWindowDTO = dto(
  'SdWhatsappWindow',
  z.object({
    open: z.boolean(),
    expiresAt: nullableDateTime().meta({
      description: 'Fim da janela de 24 h (Meta); `null` na Z-API ou fechada.',
    }),
    requiresTemplate: z.boolean().meta({
      description: 'Fora da janela na Meta: só modelo aprovado.',
    }),
  }),
)

export const SdTicketWhatsappDTO = dto(
  'SdTicketWhatsapp',
  z.object({
    configured: z.boolean().meta({
      description: 'Há conexão ativa do ServiceDesk configurada.',
    }),
    connection: z
      .object({
        id: z.string(),
        label: z.string(),
        provider: Provider,
        phoneNumber: z.string(),
        status: ConnectionStatus,
      })
      .nullable(),
    conversation: SdWhatsappConversationDTO.nullable(),
    window: SdWhatsappWindowDTO,
    suggestedWaId: z.string().nullable().meta({
      description: 'WhatsApp do contato do chamado (para iniciar a conversa).',
      example: '5511999998888',
    }),
  }),
)

export const SdWhatsappTemplateDTO = dto(
  'SdWhatsappTemplate',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'retorno_chamado' }),
    language: z.string().meta({ example: 'pt_BR' }),
    category: z.string().meta({ example: 'UTILITY' }),
    body: z.string().nullable().meta({
      description: 'Texto do corpo, com as variáveis `{{1}}`…',
    }),
    variableCount: z.number().int(),
  }),
)

/* ---------------------------------- IA ----------------------------------- */

export const SdAiTextDTO = dto(
  'SdAiText',
  z.object({
    text: z.string().meta({
      description: 'Texto gerado pelo copiloto, pronto para revisão.',
    }),
  }),
)

const Ref = z.object({ id: z.string(), name: z.string() }).nullable().meta({
  description: 'Item do catálogo do workspace (`null` = sem sugestão).',
})

export const SdAiClassificationDTO = dto(
  'SdAiClassification',
  z.object({
    category: Ref,
    subcategory: Ref,
    service: Ref,
    impact: Ref,
    urgency: Ref,
    priority: Ref,
    department: Ref,
    tags: z.array(z.string()).meta({ example: ['vpn', 'acesso'] }),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
)

export const SdAiArticleCardDTO = dto(
  'SdAiArticleCard',
  z.object({
    id: z.string(),
    title: z.string(),
    excerpt: z.string(),
  }),
)

export const SdAiMessageDTO = dto(
  'SdAiMessage',
  z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    at: dateTime(),
    articles: z.array(SdAiArticleCardDTO).optional(),
  }),
)

export const SdAiConversationDTO = dto(
  'SdAiConversation',
  z.object({
    id: z.string(),
    mode: z.enum(['COPILOT', 'PRE_SERVICE']),
    ticketId: z.string().nullable(),
    outcome: z
      .enum(['resolved_by_kb', 'ticket_opened', 'abandoned'])
      .nullable()
      .meta({ description: '`null` = conversa em andamento.' }),
    messages: z.array(SdAiMessageDTO),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdAiTicketDraftDTO = dto(
  'SdAiTicketDraft',
  z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM']),
    categoryId: z.string().nullable(),
    subcategoryId: z.string().nullable(),
    serviceId: z.string().nullable(),
    urgencyId: z.string().nullable(),
  }),
)

export const SdAiPreServiceReplyDTO = dto(
  'SdAiPreServiceReply',
  z.object({
    conversation: SdAiConversationDTO,
    reply: z.string(),
    action: z.enum(['answer', 'collect_info', 'resolved', 'open_ticket']),
    articles: z.array(SdAiArticleCardDTO),
    suggestOpenTicket: z.boolean().meta({
      description:
        'Pronto para abrir chamado (decisão da IA, palavra de transbordo ou pouca confiança).',
    }),
    ticketDraft: SdAiTicketDraftDTO,
  }),
)

export const SdAiOpenedTicketDTO = dto(
  'SdAiOpenedTicket',
  z.object({
    id: z.string(),
    number: z.number().int(),
    code: z.string().meta({ example: 'INC-000123' }),
  }),
)
