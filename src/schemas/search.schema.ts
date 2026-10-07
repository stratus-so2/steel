import { z } from 'zod'
import { SEARCH_ENTITY_TYPES } from '@/src/lib/search/search-entities'
import { SEARCH_QUERY_MAX } from '@/src/lib/search/search-query'

export const SEARCH_DEFAULT_LIMIT = 20
export const SEARCH_MAX_LIMIT = 50

/**
 * `GET /api/workspaces/{id}/search?q=&types=&limit=`. `types` is a
 * comma-separated subset of the indexed entity types; unknown values are a
 * validation error so a typo never silently widens the search.
 */
export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Informe o que buscar').max(SEARCH_QUERY_MAX),
  types: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(z.enum(SEARCH_ENTITY_TYPES)).min(1).optional()),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEARCH_MAX_LIMIT)
    .default(SEARCH_DEFAULT_LIMIT),
})

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>
