import { describe, expect, it } from 'vitest'
import {
  isSdCustomFieldApplicable,
  isSdCustomFieldEmpty,
  type SdCustomFieldDefinitionLike,
  validateSdCustomFieldValue,
  validateSdCustomFieldValues,
} from '../servicedesk/custom-fields'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { label: 'sem valor' },
  null,
]

function def(
  overrides: Partial<SdCustomFieldDefinitionLike> = {},
): SdCustomFieldDefinitionLike {
  return {
    key: 'field',
    label: 'Campo',
    type: 'TEXT',
    required: false,
    active: true,
    ...overrides,
  }
}

const check = (type: SdCustomFieldDefinitionLike['type'], value: unknown) =>
  validateSdCustomFieldValue({ type, options }, value)

describe('isSdCustomFieldEmpty', () => {
  it.each([
    [undefined, true],
    [null, true],
    ['  ', true],
    [[], true],
    ['x', false],
    [0, false],
    [false, false],
  ])('%j → %s', (value, expected) => {
    expect(isSdCustomFieldEmpty(value)).toBe(expected)
  })
})

describe('validateSdCustomFieldValue', () => {
  it('validates and trims text', () => {
    expect(check('TEXT', '  oi ')).toEqual({ ok: true, value: 'oi' })
    expect(check('TEXT', 1)).toEqual({
      ok: false,
      message: 'deve ser um texto',
    })
    expect(check('TEXT', 'x'.repeat(1001)).ok).toBe(false)
    expect(check('TEXTAREA', 'x'.repeat(5000)).ok).toBe(true)
    expect(check('TEXTAREA', 'x'.repeat(10_001)).ok).toBe(false)
  })

  it('validates numbers (with comma strings)', () => {
    expect(check('NUMBER', 3)).toEqual({ ok: true, value: 3 })
    expect(check('NUMBER', '12,5')).toEqual({ ok: true, value: 12.5 })
    expect(check('NUMBER', 'abc').ok).toBe(false)
    expect(check('NUMBER', '').ok).toBe(false)
    expect(check('NUMBER', Number.POSITIVE_INFINITY).ok).toBe(false)
    expect(check('NUMBER', true).ok).toBe(false)
  })

  it('rounds currency to two decimals', () => {
    expect(check('CURRENCY', 10.555)).toEqual({ ok: true, value: 10.56 })
    expect(check('CURRENCY', '1,2')).toEqual({ ok: true, value: 1.2 })
    expect(check('CURRENCY', 'x')).toEqual({
      ok: false,
      message: 'deve ser um valor monetário',
    })
  })

  it('validates dates', () => {
    expect(check('DATE', '2026-02-28')).toEqual({
      ok: true,
      value: '2026-02-28',
    })
    expect(check('DATE', '2026-02-30')).toEqual({
      ok: false,
      message: 'deve ser uma data válida',
    })
    expect(check('DATE', '28/02/2026').ok).toBe(false)
    expect(check('DATE', 5).ok).toBe(false)
  })

  it('normalizes datetime to ISO', () => {
    expect(check('DATETIME', '2026-01-02T10:00:00-03:00')).toEqual({
      ok: true,
      value: '2026-01-02T13:00:00.000Z',
    })
    expect(check('DATETIME', 'nope').ok).toBe(false)
    expect(check('DATETIME', 123).ok).toBe(false)
  })

  it('validates checkbox', () => {
    expect(check('CHECKBOX', false)).toEqual({ ok: true, value: false })
    expect(check('CHECKBOX', 'true').ok).toBe(false)
  })

  it('validates select against options', () => {
    expect(check('SELECT', 'a')).toEqual({ ok: true, value: 'a' })
    expect(check('SELECT', 'z').ok).toBe(false)
    expect(
      validateSdCustomFieldValue({ type: 'SELECT', options: 'bad' }, 'a').ok,
    ).toBe(false)
    expect(validateSdCustomFieldValue({ type: 'SELECT' }, 'a').ok).toBe(false)
  })

  it('validates and dedupes multi select', () => {
    expect(check('MULTI_SELECT', ['a', 'b', 'a'])).toEqual({
      ok: true,
      value: ['a', 'b'],
    })
    expect(check('MULTI_SELECT', ['a', 'z']).ok).toBe(false)
    expect(check('MULTI_SELECT', ['a', 1]).ok).toBe(false)
    expect(check('MULTI_SELECT', 'a').ok).toBe(false)
  })

  it('validates user ids', () => {
    expect(check('USER', 'u1')).toEqual({ ok: true, value: 'u1' })
    expect(check('USER', 'x'.repeat(65)).ok).toBe(false)
    expect(check('USER', 1).ok).toBe(false)
  })

  it('validates and lowercases e-mail', () => {
    expect(check('EMAIL', ' Maria@Acme.COM ')).toEqual({
      ok: true,
      value: 'maria@acme.com',
    })
    expect(check('EMAIL', 'nope').ok).toBe(false)
    expect(check('EMAIL', 1).ok).toBe(false)
  })

  it('accepts only http(s) urls', () => {
    expect(check('URL', 'https://acme.com/x')).toEqual({
      ok: true,
      value: 'https://acme.com/x',
    })
    expect(check('URL', 'ftp://acme.com').ok).toBe(false)
    expect(check('URL', 2).ok).toBe(false)
  })

  it('validates phones', () => {
    expect(check('PHONE', ' +55 (11) 99999-0000 ')).toEqual({
      ok: true,
      value: '+55 (11) 99999-0000',
    })
    expect(check('PHONE', '123').ok).toBe(false)
    expect(check('PHONE', 5).ok).toBe(false)
  })

  it('rejects unknown types', () => {
    expect(
      validateSdCustomFieldValue(
        { type: 'WEIRD' as SdCustomFieldDefinitionLike['type'] },
        'x',
      ),
    ).toEqual({ ok: false, message: 'tipo de campo desconhecido' })
  })
})

describe('isSdCustomFieldApplicable', () => {
  it('applies when the definition has no filters', () => {
    expect(isSdCustomFieldApplicable({}, { ticketType: 'INCIDENT' })).toBe(true)
  })

  it('filters by ticket type only when the context has one', () => {
    const d = { ticketTypes: ['CHANGE' as const] }
    expect(isSdCustomFieldApplicable(d, { ticketType: 'INCIDENT' })).toBe(false)
    expect(isSdCustomFieldApplicable(d, { ticketType: 'CHANGE' })).toBe(true)
    expect(isSdCustomFieldApplicable(d, {})).toBe(true)
  })

  it('filters by category, ignoring null ids', () => {
    const d = { categoryIds: ['c1'] }
    expect(isSdCustomFieldApplicable(d, { categoryIds: [null, 'c2'] })).toBe(
      false,
    )
    expect(
      isSdCustomFieldApplicable(d, { categoryIds: [undefined, 'c1'] }),
    ).toBe(true)
    expect(isSdCustomFieldApplicable(d, {})).toBe(true)
    expect(
      isSdCustomFieldApplicable({ categoryIds: [] }, { categoryIds: [] }),
    ).toBe(true)
  })
})

describe('validateSdCustomFieldValues', () => {
  const definitions = [
    def({ key: 'serial', label: 'Série', required: true }),
    def({ key: 'qty', label: 'Qtd', type: 'NUMBER', defaultValue: 1 }),
    def({ key: 'notes', label: 'Notas' }),
    def({ key: 'old', label: 'Antigo', active: false }),
    def({
      key: 'window',
      label: 'Janela',
      type: 'DATE',
      ticketTypes: ['CHANGE'],
    }),
  ]

  it('rejects a non-object payload', () => {
    for (const bad of ['x', [1], 3]) {
      const result = validateSdCustomFieldValues(definitions, bad)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('SD_CUSTOM_FIELD_INVALID')
        expect(result.error.details).toEqual({ issues: [] })
      }
    }
  })

  it('applies defaults, normalizes and omits empty optionals on create', () => {
    const result = validateSdCustomFieldValues(
      definitions,
      { serial: ' ABC ', notes: '' },
      { ticketType: 'INCIDENT' },
    )
    expect(result).toEqual({ ok: true, value: { serial: 'ABC', qty: 1 } })
  })

  it('treats null/undefined payload as empty and requires required fields', () => {
    const result = validateSdCustomFieldValues(definitions, null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('Série é obrigatório')
    expect(validateSdCustomFieldValues([], undefined)).toEqual({
      ok: true,
      value: {},
    })
  })

  it('collects every issue (unknown, inactive, not applicable, invalid)', () => {
    const result = validateSdCustomFieldValues(
      definitions,
      { ghost: 1, old: 'x', window: '2026-01-01', qty: 'abc' },
      { ticketType: 'INCIDENT' },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issues = (result.error.details as { issues: { key: string }[] })
      .issues
    expect(issues.map((i) => i.key)).toEqual([
      'ghost',
      'old',
      'window',
      'serial',
      'qty',
    ])
    expect(result.error.message).toBe('Campo desconhecido: ghost')
  })

  it('validates applicable type-restricted fields', () => {
    expect(
      validateSdCustomFieldValues(
        definitions,
        { serial: 'x', window: '2026-01-01' },
        { ticketType: 'CHANGE' },
      ),
    ).toEqual({
      ok: true,
      value: { serial: 'x', qty: 1, window: '2026-01-01' },
    })
  })

  it('partial mode validates only sent keys and returns cleared optionals as null', () => {
    expect(
      validateSdCustomFieldValues(
        definitions,
        { notes: null, qty: '2' },
        { partial: true },
      ),
    ).toEqual({ ok: true, value: { notes: null, qty: 2 } })
  })

  it('partial mode rejects clearing a required field', () => {
    const result = validateSdCustomFieldValues(
      definitions,
      { serial: '' },
      { partial: true },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('Série é obrigatório')
  })
})
