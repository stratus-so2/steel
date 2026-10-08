import { z } from 'zod'
import { SEARCH_ENTITY_TYPES } from '@/src/lib/search/search-entities'
import { dto } from '../common'

/** DTOs da busca global (`types/search.d.ts`). */

export const SearchResultDTO = dto(
  'SearchResult',
  z
    .object({
      type: z.enum(SEARCH_ENTITY_TYPES).meta({ example: 'sd-ticket' }),
      id: z.string().meta({ example: 'ckw1tckt0000ab7d3k1e5xyz' }),
      title: z.string().meta({ example: 'Impressora do financeiro parada' }),
      subtitle: z
        .string()
        .nullable()
        .meta({ example: 'INC-000123 · Incidente · Em atendimento' }),
      snippet: z.string().nullable(),
      href: z.string().meta({ example: '/agro/servicedesk/tickets/123' }),
      module: z.enum(['SERVICE_DESK', 'CRM', 'COMMUNICATION']).nullable(),
      group: z.string().meta({ example: 'Chamados' }),
      score: z.number(),
      isMine: z.boolean(),
      updatedAt: z.iso.datetime(),
    })
    .meta({
      description:
        'Registro encontrado. `href` já vem prefixado com o slug do workspace.',
    }),
)

export const SearchResponseDTO = dto(
  'SearchResponse',
  z.object({
    query: z.string(),
    results: z.array(SearchResultDTO),
    tookMs: z.number().int(),
  }),
)
