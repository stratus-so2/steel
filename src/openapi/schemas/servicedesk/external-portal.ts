import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs do **portal do contato externo** do ServiceDesk
 * (`types/sd-portal.d.ts`). Recorte mínimo do chamado: nada de nota
 * interna, custo, peça, aprovação, assinatura, SLA, departamento ou
 * rastreabilidade.
 */

const dateTime = () => z.iso.datetime()

const ticketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])
const phaseCategory = z.enum([
  'NEW',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'CANCELED',
])

export const SdPortalSessionDTO = dto(
  'SdPortalSession',
  z.object({
    contact: z.object({
      id: z.string(),
      name: z.string().meta({ example: 'Ana Souza' }),
      email: z.string().nullable(),
    }),
    workspace: z.object({
      id: z.string(),
      name: z.string().meta({ example: 'Stratus Telecom' }),
      slug: z.string(),
    }),
    customers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        isPrimary: z.boolean(),
      }),
    ),
    expiresAt: dateTime().meta({
      description: 'Fim da sessão de 12 horas.',
    }),
    companyScope: z.boolean().meta({
      description:
        'O contato vê os chamados das empresas dele (`SdSettings.portalCompanyScope`), não só os próprios.',
    }),
    ticketTypes: z.array(ticketType).meta({
      description: 'Tipos que ele pode abrir (`SdSettings.portalTicketTypes`).',
    }),
  }),
)

export const SdPortalLinkRequestDTO = dto(
  'SdPortalLinkRequest',
  z.object({
    message: z.string().meta({
      example:
        'Se este e-mail estiver cadastrado como contato, o link de acesso chega em instantes.',
      description:
        'Mensagem genérica, idêntica exista ou não o e-mail — a rota não revela clientes.',
    }),
  }),
)

const phase = z.object({
  name: z.string().meta({ example: 'Em atendimento' }),
  color: z.string().nullable(),
  category: phaseCategory,
})

export const SdPortalTicketSummaryDTO = dto(
  'SdPortalTicketSummary',
  z.object({
    id: z.string(),
    number: z.number().int(),
    code: z.string().meta({ example: 'INC-000123' }),
    type: ticketType,
    title: z.string(),
    phase,
    completionPercent: z.number().int().meta({
      description: '% da fase atual (a barra de progresso do portal).',
    }),
    companyName: z.string().nullable(),
    assigneeName: z.string().nullable().meta({
      example: 'Carlos A.',
      description: 'Nome curto de quem atende — nunca o e-mail do agente.',
    }),
    closed: z.boolean(),
    csatScore: z.number().int().nullable(),
    lastActivityAt: dateTime(),
    createdAt: dateTime(),
  }),
)

export const SdPortalTicketPageDTO = dto(
  'SdPortalTicketPage',
  z.object({
    items: z.array(SdPortalTicketSummaryDTO),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
)

export const SdPortalMessageDTO = dto(
  'SdPortalMessage',
  z.object({
    id: z.string(),
    authorKind: z.enum(['AGENT', 'REQUESTER', 'CONTACT', 'AI', 'SYSTEM']),
    authorName: z.string().meta({ example: 'Carlos A.' }),
    mine: z.boolean().meta({
      description: 'Escrita pelo próprio contato da sessão.',
    }),
    body: z.string(),
    attachments: z.array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        size: z.number().int(),
        url: z.string().meta({
          example:
            '/api/servicedesk/portal/tickets/123/attachments/ckatt0000ab7d3k1e5xyz',
        }),
      }),
    ),
    createdAt: dateTime(),
  }),
)

export const SdPortalTicketDetailDTO = dto(
  'SdPortalTicketDetail',
  z.object({
    id: z.string(),
    number: z.number().int(),
    code: z.string().meta({ example: 'INC-000123' }),
    type: ticketType,
    title: z.string(),
    phase,
    completionPercent: z.number().int(),
    companyName: z.string().nullable(),
    assigneeName: z.string().nullable(),
    closed: z.boolean(),
    csatScore: z.number().int().nullable(),
    lastActivityAt: dateTime(),
    createdAt: dateTime(),
    description: z.string().nullable().meta({
      description: 'HTML já sanitizado do relato de abertura.',
    }),
    subject: z.string().nullable().meta({
      example: 'Infraestrutura › Impressão › Impressora do 3º andar',
    }),
    urgencyName: z.string().nullable(),
    solution: z.string().nullable(),
    resolvedAt: dateTime().nullable(),
    closedAt: dateTime().nullable(),
    csatComment: z.string().nullable(),
    canReply: z.boolean(),
    canRate: z.boolean(),
    messages: z.array(SdPortalMessageDTO).meta({
      description: 'Só mensagens públicas e vivas (nota interna nunca sai).',
    }),
  }),
)

export const SdPortalCsatDTO = dto(
  'SdPortalCsat',
  z.object({
    csatScore: z.number().int().min(1).max(5),
    csatComment: z.string().nullable(),
  }),
)

const catalogNode: z.ZodType = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    ticketTypes: z.array(ticketType),
    children: z.array(catalogNode),
  }),
)

export const SdPortalFormOptionsDTO = dto(
  'SdPortalFormOptions',
  z.object({
    ticketTypes: z.array(ticketType),
    catalog: z.array(catalogNode).meta({
      description:
        'Catálogo visível no portal (`SdCategory.portalVisible`), em árvore.',
    }),
    templates: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        ticketType: ticketType,
      }),
    ),
    urgencies: z.array(z.object({ id: z.string(), name: z.string() })),
    customFields: z.array(
      z.object({
        id: z.string(),
        key: z.string(),
        label: z.string(),
        description: z.string().nullable(),
        type: z.string(),
        required: z.boolean(),
        options: z.array(z.object({ value: z.string(), label: z.string() })),
        ticketTypes: z.array(ticketType),
        categoryIds: z.array(z.string()),
      }),
    ),
  }),
)

const kbArticleSummary = z.object({
  id: z.string(),
  workspaceId: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  icon: z.string().nullable(),
  coverImage: z.string().nullable(),
  status: z.literal('PUBLISHED'),
  visibility: z.literal('PORTAL'),
  categoryId: z.string().nullable(),
  tags: z.array(z.string()),
  position: z.number().int(),
  viewCount: z.number().int(),
  helpfulCount: z.number().int(),
  notHelpfulCount: z.number().int(),
  publishedAt: dateTime().nullable(),
  archivedAt: dateTime().nullable(),
  createdAt: dateTime(),
  updatedAt: dateTime(),
  excerpt: z.string().optional(),
  rank: z.number().optional(),
})

export const SdPortalKbListDTO = dto(
  'SdPortalKbList',
  z.object({
    articles: z.array(kbArticleSummary),
    categories: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string().nullable(),
      }),
    ),
  }),
)

export const SdPortalKbArticleDTO = dto(
  'SdPortalKbArticle',
  kbArticleSummary.extend({
    content: z.array(z.record(z.string(), z.unknown())).meta({
      description: 'Conteúdo Plate do artigo (somente leitura).',
    }),
    readingMinutes: z.number().int(),
    category: z
      .object({
        id: z.string(),
        name: z.string(),
        icon: z.string().nullable(),
      })
      .nullable(),
  }),
)

export const SdPortalAccessDTO = dto(
  'SdPortalAccess',
  z.object({
    id: z.string(),
    contactId: z.string(),
    email: z.string(),
    requestedBy: z
      .object({ id: z.string(), name: z.string() })
      .nullable()
      .meta({
        description: 'Agente que enviou; `null` quando o contato pediu.',
      }),
    expiresAt: dateTime().meta({ description: 'Validade do link (7 dias).' }),
    usedAt: dateTime().nullable(),
    sessionExpiresAt: dateTime().nullable(),
    revokedAt: dateTime().nullable(),
    status: z.enum(['pending', 'active', 'used', 'expired', 'revoked']),
    createdAt: dateTime(),
  }),
)
