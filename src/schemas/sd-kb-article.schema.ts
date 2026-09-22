import { z } from 'zod'

/**
 * Base de conhecimento do ServiceDesk — port da Wiki do Nexo (Plate) com
 * status (rascunho/publicado), visibilidade (interno/portal), categoria do
 * catálogo, tags, votos de utilidade e vínculo com chamados.
 */

export const SD_KB_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export const SD_KB_VISIBILITIES = ['INTERNAL', 'PORTAL'] as const

export const SdKbStatusEnum = z.enum(SD_KB_STATUSES)
export const SdKbVisibilityEnum = z.enum(SD_KB_VISIBILITIES)

/** Tamanho máximo do JSON do Plate (autosave). */
export const SD_KB_CONTENT_MAX_CHARS = 200_000
export const SD_KB_MAX_TAGS = 20

const id = z.string().trim().min(1).max(64)

const title = z.string().max(255, 'Título deve ter no máximo 255 caracteres')

const icon = z.string().max(16, 'Ícone inválido')

export const SdKbContentSchema = z
  .array(z.record(z.string(), z.unknown()))
  .refine(
    (value) => JSON.stringify(value).length <= SD_KB_CONTENT_MAX_CHARS,
    'Conteúdo excede o tamanho permitido',
  )

/**
 * Capa: URL absoluta (http/https) ou o caminho estável de uma mídia da KB
 * servida pela própria API (`/api/workspaces/<id>/servicedesk/knowledge/...`).
 */
const coverImage = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      /^https?:\/\/\S+$/i.test(value) ||
      /^\/api\/workspaces\/[^/\s]+\/servicedesk\/knowledge\/[^\s]+$/.test(
        value,
      ),
    'Capa inválida',
  )

/** Tags normalizadas: aparadas, minúsculas, sem repetição. */
export const SdKbTagsSchema = z
  .array(
    z.string().trim().min(1).max(40, 'Tag deve ter no máximo 40 caracteres'),
  )
  .max(SD_KB_MAX_TAGS, `No máximo ${SD_KB_MAX_TAGS} tags`)
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))])

export const CreateSdKbArticleSchema = z.object({
  title: title.default(''),
  parentId: id.optional(),
  icon: icon.optional(),
  categoryId: id.optional(),
  visibility: SdKbVisibilityEnum.optional(),
  tags: SdKbTagsSchema.optional(),
})

export type CreateSdKbArticleDTO = z.infer<typeof CreateSdKbArticleSchema>

export const UpdateSdKbArticleSchema = z.object({
  title: title.optional(),
  icon: icon.nullable().optional(),
  coverImage: coverImage.nullable().optional(),
  content: SdKbContentSchema.optional(),
  categoryId: id.nullable().optional(),
  visibility: SdKbVisibilityEnum.optional(),
  tags: SdKbTagsSchema.optional(),
})

export type UpdateSdKbArticleDTO = z.infer<typeof UpdateSdKbArticleSchema>

export const MoveSdKbArticleSchema = z.object({
  parentId: id.nullable(),
  position: z.number().int().nonnegative(),
})

export type MoveSdKbArticleDTO = z.infer<typeof MoveSdKbArticleSchema>

export const SetSdKbArticleStatusSchema = z.object({
  status: SdKbStatusEnum,
})

export type SetSdKbArticleStatusDTO = z.infer<typeof SetSdKbArticleStatusSchema>

/** `archived=true` lista a lixeira (arquivados) em vez da árvore viva. */
export const ListSdKbArticlesSchema = z.object({
  archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export type ListSdKbArticlesDTO = z.infer<typeof ListSdKbArticlesSchema>

export const SearchSdKbArticlesSchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  status: SdKbStatusEnum.optional(),
  visibility: SdKbVisibilityEnum.optional(),
  categoryId: id.optional(),
  tag: z.string().trim().toLowerCase().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type SearchSdKbArticlesDTO = z.infer<typeof SearchSdKbArticlesSchema>

/** `helpful: null` retira o voto do usuário. */
export const VoteSdKbArticleSchema = z.object({
  helpful: z.boolean().nullable(),
})

export type VoteSdKbArticleDTO = z.infer<typeof VoteSdKbArticleSchema>

export const LinkSdKbArticleToTicketSchema = z.object({
  articleId: id,
})

export type LinkSdKbArticleToTicketDTO = z.infer<
  typeof LinkSdKbArticleToTicketSchema
>

export const SuggestSdKbArticlesSchema = z.object({
  ticketId: id,
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export type SuggestSdKbArticlesDTO = z.infer<typeof SuggestSdKbArticlesSchema>

export const ListSdKbMentionableMembersSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
})

export type ListSdKbMentionableMembersDTO = z.infer<
  typeof ListSdKbMentionableMembersSchema
>
