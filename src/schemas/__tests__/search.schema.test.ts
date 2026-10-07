import { describe, expect, it } from 'vitest'
import { SEARCH_DEFAULT_LIMIT, SearchQuerySchema } from '../search.schema'

describe('SearchQuerySchema', () => {
  it('should trim the query and default the limit', () => {
    expect(SearchQuerySchema.parse({ q: '  agro ' })).toEqual({
      q: 'agro',
      types: undefined,
      limit: SEARCH_DEFAULT_LIMIT,
    })
  })

  it('should split comma-separated types and coerce the limit', () => {
    expect(
      SearchQuerySchema.parse({
        q: 'x',
        types: 'sd-ticket, crm-lead,,',
        limit: '5',
      }),
    ).toEqual({ q: 'x', types: ['sd-ticket', 'crm-lead'], limit: 5 })
  })

  it('should treat an empty types param as all types', () => {
    expect(
      SearchQuerySchema.parse({ q: 'x', types: ' ' }).types,
    ).toBeUndefined()
  })

  it('should reject unknown types, empty queries and out-of-range limits', () => {
    expect(SearchQuerySchema.safeParse({ q: 'x', types: 'nope' }).success).toBe(
      false,
    )
    expect(SearchQuerySchema.safeParse({ q: '   ' }).success).toBe(false)
    expect(SearchQuerySchema.safeParse({ q: 'x', limit: 0 }).success).toBe(
      false,
    )
    expect(SearchQuerySchema.safeParse({ q: 'x', limit: 51 }).success).toBe(
      false,
    )
    expect(SearchQuerySchema.safeParse({ q: 'x'.repeat(121) }).success).toBe(
      false,
    )
  })
})
