import { describe, expect, it } from 'vitest'
import {
  ALLOWED_LOG_FIELD_KEYS,
  capFieldKeys,
  flattenNestedFields,
  LOG_DETAIL_MAX_CHARS,
  logFields,
  stringifyLogValue,
} from '@/lib/axiom/log-fields'

describe('stringifyLogValue()', () => {
  it('should keep strings and JSON-encode the rest', () => {
    expect(stringifyLogValue('plain')).toBe('plain')
    expect(stringifyLogValue({ a: [1, 2] })).toBe('{"a":[1,2]}')
  })

  it('should cut long values', () => {
    const text = stringifyLogValue('x'.repeat(LOG_DETAIL_MAX_CHARS + 10))
    expect(text).toHaveLength(LOG_DETAIL_MAX_CHARS + 1)
    expect(text.endsWith('…')).toBe(true)
    expect(stringifyLogValue('abcdef', 3)).toBe('abc…')
  })

  it('should serialize errors and bigints, and survive cycles', () => {
    expect(stringifyLogValue({ e: new Error('boom'), n: BigInt(5) })).toBe(
      '{"e":{"name":"Error","message":"boom"},"n":"5"}',
    )
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(stringifyLogValue(cyclic)).toBe('[unserializable]')
  })
})

describe('logFields()', () => {
  it('should emit the fixed keys plus one detail string', () => {
    expect(
      logFields(
        {
          component: 'SteelAiChatService',
          workspaceId: 'ws1',
          conversationId: undefined,
          actionId: null,
        },
        { tools: ['a', 'b'], pendingActions: 1 },
      ),
    ).toEqual({
      component: 'SteelAiChatService',
      workspaceId: 'ws1',
      actionId: null,
      detail: '{"tools":["a","b"],"pendingActions":1}',
    })
  })

  it('should omit an empty detail', () => {
    expect(logFields({ component: 'X' }, {})).toEqual({ component: 'X' })
    expect(logFields({ component: 'X', message: 'm' })).toEqual({
      component: 'X',
      message: 'm',
    })
  })
})

describe('flattenNestedFields()', () => {
  it('should turn nested objects and arrays under fields into strings', () => {
    const event = {
      level: 'info',
      request: { path: '/api/x' },
      fields: {
        component: 'C',
        count: 2,
        ok: true,
        empty: null,
        preview: { title: 'T', items: [{ a: 1 }] },
        tools: ['a'],
      },
    }
    expect(flattenNestedFields(event)).toEqual({
      level: 'info',
      // Root-level objects (request log) are untouched.
      request: { path: '/api/x' },
      fields: {
        component: 'C',
        count: 2,
        ok: true,
        empty: null,
        preview: '{"title":"T","items":[{"a":1}]}',
        tools: '["a"]',
      },
    })
  })

  it('should return the same event when there is nothing to flatten', () => {
    const flat = { fields: { a: 1 } }
    expect(flattenNestedFields(flat)).toBe(flat)
    const none: { message: string; fields?: unknown } = { message: 'x' }
    expect(flattenNestedFields(none)).toBe(none)
    const arrayFields = { fields: ['x'] }
    expect(flattenNestedFields(arrayFields)).toBe(arrayFields)
  })
})

describe('capFieldKeys()', () => {
  it('keeps allowlisted keys and folds the rest into detail', () => {
    const out = capFieldKeys({
      message: 'x',
      fields: { component: 'Worker', workspaceId: 'w1', foo: 1, bar: 'b' },
    })
    expect(out.fields).toEqual({
      component: 'Worker',
      workspaceId: 'w1',
      detail: JSON.stringify({ foo: 1, bar: 'b' }),
    })
  })

  it('keeps a caller detail inside the merged detail', () => {
    const out = capFieldKeys({
      fields: { component: 'AI', detail: '{"tool":"t"}', extra: true },
    })
    expect(out.fields).toEqual({
      component: 'AI',
      detail: JSON.stringify({ extra: true, detail: '{"tool":"t"}' }),
    })
  })

  it('returns the same event when every key is allowed', () => {
    const event = { fields: { component: 'x', detail: 'd' } }
    expect(capFieldKeys(event)).toBe(event)
  })

  it('ignores events without an object of fields', () => {
    const none: { message: string; fields?: unknown } = { message: 'm' }
    const list = { fields: [1, 2] }
    expect(capFieldKeys(none)).toBe(none)
    expect(capFieldKeys(list)).toBe(list)
  })

  it('allows the audit keys the LGPD export queries', () => {
    expect(ALLOWED_LOG_FIELD_KEYS.has('category')).toBe(true)
    expect(ALLOWED_LOG_FIELD_KEYS.has('actorId')).toBe(true)
  })
})
