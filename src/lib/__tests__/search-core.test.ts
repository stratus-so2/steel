import { describe, expect, it } from 'vitest'
import {
  clampBody,
  joinParts,
  snippetOf,
  stripHtml,
  userIdsOf,
} from '../search/search-document'
import {
  isSearchEntityType,
  SEARCH_ENTITIES,
  SEARCH_ENTITY_TYPES,
} from '../search/search-entities'
import {
  canonicalCode,
  codesFor,
  digitsOnly,
  foldSearchText,
  highlightRanges,
  parseSearchQuery,
  phoneCodes,
} from '../search/search-query'
import {
  rankSearchHits,
  recencyBoost,
  SEARCH_WEIGHTS,
  type SearchHitSignals,
  scoreSearchHit,
} from '../search/search-ranking'

const NOW = new Date('2026-10-07T12:00:00.000Z')

function signals(overrides: Partial<SearchHitSignals> = {}): SearchHitSignals {
  return {
    exact: false,
    titlePrefix: false,
    titlePhrase: false,
    textRank: 0,
    similarity: 0,
    updatedAt: NOW,
    isMine: false,
    ...overrides,
  }
}

describe('search entities', () => {
  it('should describe every indexed type with a group and a module', () => {
    for (const type of SEARCH_ENTITY_TYPES) {
      expect(SEARCH_ENTITIES[type].group).toBeTruthy()
      expect(isSearchEntityType(type)).toBe(true)
    }
    expect(isSearchEntityType('sd-nope')).toBe(false)
    expect(SEARCH_ENTITIES.member).toMatchObject({
      module: null,
      resource: null,
    })
  })
})

describe('search query', () => {
  it('should fold accents, case and spaces', () => {
    expect(foldSearchText('  Ação   Não  ÉRA ')).toBe('acao nao era')
    expect(digitsOnly('+55 (11) 9999-0000')).toBe('551199990000')
  })

  it('should canonicalize ticket codes and numbers', () => {
    expect(canonicalCode('INC-000123')).toBe('inc-123')
    expect(canonicalCode('inc123')).toBe('inc-123')
    expect(canonicalCode('INC 7')).toBe('inc-7')
    expect(canonicalCode('#000123')).toBe('123')
    expect(canonicalCode('123')).toBe('123')
    expect(canonicalCode('Joao@ACME.com')).toBe('joao@acme.com')
  })

  it('should expose phones with and without the Brazilian country code', () => {
    expect(phoneCodes('+55 11 99999-0000')).toEqual([
      '5511999990000',
      '11999990000',
    ])
    expect(phoneCodes('11 99999-0000')).toEqual(['11999990000'])
    expect(phoneCodes('1234')).toEqual([])
  })

  it('should build distinct exact keys and skip empty values', () => {
    expect(
      codesFor(['INC-000001', null, '  ', undefined, 'INC-1', '5511999990000']),
    ).toEqual(['inc-1', '5511999990000', '11999990000'])
  })

  it('should parse a free-text query into a safe prefix tsquery', () => {
    expect(parseSearchQuery('Impressão  conf!')).toEqual({
      text: 'impressao conf!',
      codes: ['impressao conf!'],
      tsquery: 'impressao:* & conf:*',
    })
  })

  it('should keep exact code candidates for codes and phones', () => {
    const parsed = parseSearchQuery('INC-000123')
    expect(parsed.codes).toEqual(['inc-000123', 'inc-123'])
    expect(parsed.tsquery).toBe('inc:* & 000123:*')
    expect(parseSearchQuery('(11) 99999-0000').codes).toContain('11999990000')
  })

  it('should return no tsquery for punctuation and an empty query', () => {
    expect(parseSearchQuery('!!!').tsquery).toBeNull()
    expect(parseSearchQuery('   ')).toEqual({
      text: '',
      codes: [],
      tsquery: null,
    })
  })

  it('should strip tsquery operators from the input', () => {
    expect(parseSearchQuery("a' | b & !c:*").tsquery).toBe('a:* & b:* & c:*')
  })

  it('should highlight matched tokens ignoring accents and keep indexes', () => {
    expect(highlightRanges('Impressão não imprime', 'impressao')).toEqual([
      [0, 9],
    ])
    expect(highlightRanges('Agro Telecom Agro', 'agro tele')).toEqual([
      [0, 4],
      [5, 9],
      [13, 17],
    ])
    expect(highlightRanges('INC-000123', '123')).toEqual([[7, 10]])
  })

  it('should merge overlapping ranges and ignore one-letter tokens', () => {
    expect(highlightRanges('abcdef', 'abcd cdef')).toEqual([[0, 6]])
    expect(highlightRanges('a casa', 'a')).toEqual([])
    expect(highlightRanges('', 'casa')).toEqual([])
    expect(highlightRanges('casa', '   ')).toEqual([])
  })
})

describe('search ranking', () => {
  it('should put an exact code above everything else', () => {
    const exact = scoreSearchHit(signals({ exact: true }), NOW)
    const best = scoreSearchHit(
      signals({
        titlePrefix: true,
        textRank: 1,
        similarity: 1,
        isMine: true,
      }),
      NOW,
    )
    expect(exact).toBeGreaterThan(best)
  })

  it('should rank prefix over phrase over full-text over fuzzy', () => {
    const prefix = scoreSearchHit(signals({ titlePrefix: true }), NOW)
    const phrase = scoreSearchHit(signals({ titlePhrase: true }), NOW)
    const text = scoreSearchHit(signals({ textRank: 0.9 }), NOW)
    const fuzzy = scoreSearchHit(signals({ similarity: 0.6 }), NOW)
    expect(prefix).toBeGreaterThan(phrase)
    expect(phrase).toBeGreaterThan(text)
    expect(text).toBeGreaterThan(fuzzy)
  })

  it('should not double count prefix and phrase', () => {
    expect(
      scoreSearchHit(signals({ titlePrefix: true, titlePhrase: true }), NOW),
    ).toBe(scoreSearchHit(signals({ titlePrefix: true }), NOW))
  })

  it('should clamp bad signal values', () => {
    const base = scoreSearchHit(signals(), NOW)
    expect(
      scoreSearchHit(signals({ textRank: -3, similarity: Number.NaN }), NOW),
    ).toBe(base)
    expect(scoreSearchHit(signals({ textRank: 9 }), NOW)).toBe(
      scoreSearchHit(signals({ textRank: 1 }), NOW),
    )
  })

  it('should decay the recency boost by half-life and ignore the future', () => {
    expect(recencyBoost(NOW, NOW)).toBe(SEARCH_WEIGHTS.recency)
    const old = new Date(NOW.getTime() - 30 * 86_400_000)
    expect(recencyBoost(old, NOW)).toBeCloseTo(SEARCH_WEIGHTS.recency / 2)
    expect(recencyBoost(new Date(NOW.getTime() + 1000), NOW)).toBe(
      SEARCH_WEIGHTS.recency,
    )
  })

  it('should boost records of the user and recent ones inside a tier', () => {
    const old = new Date('2025-01-01T00:00:00.000Z')
    const mine = scoreSearchHit(signals({ isMine: true, updatedAt: old }), NOW)
    const other = scoreSearchHit(signals({ updatedAt: old }), NOW)
    expect(mine - other).toBeCloseTo(SEARCH_WEIGHTS.mine)
  })

  it('should dedupe, sort by score, break ties by recency and cut', () => {
    const older = new Date('2026-01-01T00:00:00.000Z')
    const ranked = rankSearchHits(
      [
        {
          entityType: 'crm-lead',
          entityId: 'a',
          signals: signals({ similarity: 0.5, updatedAt: older }),
        },
        {
          entityType: 'crm-lead',
          entityId: 'a',
          signals: signals({ exact: true, updatedAt: older }),
        },
        {
          entityType: 'crm-lead',
          entityId: 'a',
          signals: signals({ similarity: 0.1, updatedAt: older }),
        },
        {
          entityType: 'crm-person',
          entityId: 'a',
          signals: signals({ titlePrefix: true }),
        },
        {
          entityType: 'crm-task',
          entityId: 'b',
          signals: signals({ titlePhrase: true, updatedAt: older }),
        },
        {
          entityType: 'crm-task',
          entityId: 'c',
          signals: signals({ titlePhrase: true, updatedAt: older }),
        },
      ],
      NOW,
      3,
    )
    expect(ranked.map((h) => `${h.entityType}:${h.entityId}`)).toEqual([
      'crm-lead:a',
      'crm-person:a',
      'crm-task:b',
    ])
    expect(ranked[0].score).toBeGreaterThan(SEARCH_WEIGHTS.exact)
  })

  it('should order equal scores by most recent first', () => {
    const ranked = rankSearchHits(
      [
        {
          entityType: 'crm-task',
          entityId: 'old',
          signals: signals({ updatedAt: new Date('2020-01-01T00:00:00Z') }),
        },
        {
          entityType: 'crm-task',
          entityId: 'new',
          signals: signals({ updatedAt: new Date('2020-01-02T00:00:00Z') }),
        },
      ],
      NOW,
      10,
    )
    expect(ranked.map((h) => h.entityId)).toEqual(['new', 'old'])
  })
})

describe('search document helpers', () => {
  it('should strip html and decode entities', () => {
    expect(
      stripHtml(
        '<p>Olá&nbsp;<b>mundo</b> &amp; &lt;tag&gt; &quot;x&quot; &#39;y&#39;</p><script>alert(1)</script><style>p{}</style>',
      ),
    ).toBe(`Olá mundo & <tag> "x" 'y'`)
    expect(stripHtml(null)).toBe('')
  })

  it('should join non-empty parts', () => {
    expect(joinParts(['a', null, ' ', false, undefined, ' b '])).toBe('a · b')
    expect(joinParts(['x', 'y'], '/')).toBe('x/y')
    expect(joinParts([null, ''])).toBeNull()
  })

  it('should clamp bodies and build snippets', () => {
    expect(clampBody('  a   b ')).toBe('a b')
    expect(clampBody(null)).toBeNull()
    expect(clampBody('x'.repeat(5000))).toHaveLength(4000)
    expect(snippetOf(undefined)).toBeNull()
    expect(snippetOf('curto')).toBe('curto')
    const long = snippetOf('palavra '.repeat(40)) as string
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long.endsWith('…')).toBe(true)
  })

  it('should dedupe user ids and drop empty ones', () => {
    expect(userIdsOf(['u1', null, 'u2', 'u1', undefined, ''])).toEqual([
      'u1',
      'u2',
    ])
  })
})
