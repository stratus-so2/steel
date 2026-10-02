import { z } from 'zod'
import { dto } from '../../common'

/** DTOs da base de conhecimento do ServiceDesk (`types/sd-kb-*.d.ts`). */

const PlateValue = z.array(z.record(z.string(), z.unknown())).meta({
  description: 'Documento do editor Plate (lista de blocos).',
  example: [{ type: 'p', children: [{ text: 'Reinicie o cliente VPN.' }] }],
})

const UserRef = z
  .object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  })
  .nullable()

const summaryShape = {
  id: z.string().meta({ example: 'ckw1kbart0000ab7d3k1e5xyz' }),
  workspaceId: z.string(),
  parentId: z.string().nullable(),
  title: z.string().meta({ example: 'Como redefinir a senha da VPN' }),
  icon: z.string().nullable().meta({ example: '🔐' }),
  coverImage: z.string().nullable(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED']).meta({
    description:
      'Ciclo KCS: `DRAFT` → `IN_REVIEW` (revisor escolhido) → `PUBLISHED`.',
  }),
  visibility: z.enum(['INTERNAL', 'PORTAL']).meta({
    description: '`PORTAL`: solicitantes leem quando publicado.',
  }),
  categoryId: z.string().nullable(),
  tags: z.array(z.string()).meta({ example: ['vpn', 'acesso'] }),
  position: z.number(),
  viewCount: z.number(),
  helpfulCount: z.number(),
  notHelpfulCount: z.number(),
  reuseCount: z.number().meta({
    description: 'KCS: quantos chamados este artigo resolveu.',
    example: 4,
  }),
  sourceTicketId: z.string().nullable().meta({
    description: 'Chamado que originou o artigo, quando veio de um.',
  }),
  reviewIntervalDays: z.number().nullable().meta({
    description:
      'Validade da revisão deste artigo; `null` usa o padrão do workspace.',
    example: 180,
  }),
  reviewDueAt: z.iso.datetime().nullable(),
  lastReviewedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}

export const SdKbArticleSummaryDTO = dto(
  'SdKbArticleSummary',
  z.object(summaryShape),
)

export const SdKbArticleDTO = dto(
  'SdKbArticle',
  z.object({
    ...summaryShape,
    content: PlateValue,
    readingMinutes: z.number().meta({ example: 3 }),
    createdById: z.string().nullable(),
    updatedById: z.string().nullable(),
    createdBy: UserRef,
    updatedBy: UserRef,
    category: z
      .object({ id: z.string(), name: z.string(), icon: z.string().nullable() })
      .nullable(),
    myVote: z.enum(['up', 'down']).nullable(),
  }),
)

export const SdKbSearchResultDTO = dto(
  'SdKbSearchResult',
  z.object({
    ...summaryShape,
    excerpt: z.string().meta({ example: '…reinicie o cliente VPN e…' }),
    rank: z.number(),
  }),
)

export const SdKbCategoryDTO = dto(
  'SdKbCategory',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'Acesso e senhas' }),
    icon: z.string().nullable(),
    description: z.string().nullable(),
    parentId: z.string().nullable(),
    articleCount: z.number(),
  }),
)

export const SdKbVoteResultDTO = dto(
  'SdKbVoteResult',
  z.object({
    helpfulCount: z.number(),
    notHelpfulCount: z.number(),
    myVote: z.enum(['up', 'down']).nullable(),
  }),
)

export const SdKbViewResultDTO = dto(
  'SdKbViewResult',
  z.object({
    viewCount: z.number(),
    counted: z.boolean().meta({
      description: '`false` quando o usuário já viu o artigo hoje.',
    }),
  }),
)

export const SdKbMediaDTO = dto(
  'SdKbMedia',
  z.object({
    key: z.string().meta({ example: 'ws1/kb/art1/ckw1file.png' }),
    url: z.string().meta({
      example:
        '/api/workspaces/ws1/servicedesk/knowledge/art1/media/ckw1file.png',
    }),
    name: z.string().meta({ example: 'diagrama.png' }),
  }),
)

export const SdKbCommentDTO = dto(
  'SdKbComment',
  z.object({
    id: z.string(),
    articleId: z.string(),
    markId: z.string(),
    parentId: z.string().nullable(),
    content: PlateValue,
    author: UserRef,
    resolved: z.boolean(),
    resolvedAt: z.iso.datetime().nullable(),
    resolvedById: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
)

export const SdKbMentionableMemberDTO = dto(
  'SdKbMentionableMember',
  z.object({
    userId: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
)

export const SdTicketKbLinkDTO = dto(
  'SdTicketKbLink',
  z.object({
    ticketId: z.string(),
    article: SdKbArticleSummaryDTO,
    linkedById: z.string().nullable(),
    resolvedTicket: z.boolean().meta({
      description:
        'KCS: este artigo resolveu o chamado — é o que conta no reuso.',
    }),
    createdAt: z.iso.datetime(),
  }),
)

/* ------------------------------- KCS ------------------------------------- */

const SdKbReviewArticleRef = z
  .object({
    id: z.string(),
    title: z.string(),
    icon: z.string().nullable(),
    status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED']),
  })
  .nullable()

export const SdKbReviewDTO = dto(
  'SdKbReview',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    articleId: z.string(),
    status: z.enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED']),
    comment: z.string().nullable(),
    decidedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    reviewerId: z.string().nullable(),
    reviewer: UserRef,
    article: SdKbReviewArticleRef,
  }),
)

export const SdKbReviewStateDTO = dto(
  'SdKbReviewState',
  z.object({
    articleId: z.string(),
    status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED']),
    reviewIntervalDays: z.number().nullable(),
    effectiveIntervalDays: z.number().meta({
      description: 'Validade do artigo ou, na falta dela, a do workspace.',
      example: 180,
    }),
    reviewDueAt: z.iso.datetime().nullable(),
    lastReviewedAt: z.iso.datetime().nullable(),
    overdue: z.boolean(),
    pending: SdKbReviewDTO.nullable(),
    history: z.array(SdKbReviewDTO),
  }),
)

export const SdKbReviewSettingsDTO = dto(
  'SdKbReviewSettings',
  z.object({
    defaultIntervalDays: z.number().meta({ example: 180 }),
  }),
)

export const SdKbStatsDTO = dto(
  'SdKbStats',
  z.object({
    totals: z.object({
      published: z.number(),
      inReview: z.number(),
      overdue: z.number(),
      neverReused: z.number(),
      resolvedTickets: z.number().meta({
        description: 'Soma do reuso de todos os artigos vivos.',
      }),
    }),
    mostReused: z.array(SdKbArticleSummaryDTO),
    overdue: z.array(SdKbArticleSummaryDTO),
    neverReused: z.array(SdKbArticleSummaryDTO),
  }),
)

export const SdKbDraftFromTicketDTO = dto(
  'SdKbDraftFromTicket',
  z.object({
    article: SdKbArticleDTO,
    aiUsed: z.boolean().meta({
      description: '`false` = rascunho com o esqueleto KCS, sem IA.',
    }),
    aiSkippedReason: z.string().nullable().meta({
      description:
        'Por que a IA não escreveu (`ai_disabled`, `AI_QUOTA_EXCEEDED`, `ai_provider_unavailable`, `ai_invalid_output`, `ai_not_requested`).',
    }),
  }),
)
