import { describe, expect, it } from 'vitest'
import {
  parseCiAttributeSchema,
  type SdCiAttributeDefinition,
  validateCiAttributes,
} from '@/src/lib/servicedesk/ci-attributes'

const SCHEMA: SdCiAttributeDefinition[] = [
  { key: 'hostname', label: 'Hostname', type: 'text', required: true },
  { key: 'ram_gb', label: 'RAM (GB)', type: 'number' },
  { key: 'installed_on', label: 'Instalado em', type: 'date' },
  { key: 'os', label: 'SO', type: 'select', options: ['Linux', 'Windows'] },
  { key: 'virtual', label: 'Virtual', type: 'boolean' },
]

describe('validateCiAttributes()', () => {
  it('normalizes valid values and drops empty ones', () => {
    expect(
      validateCiAttributes(SCHEMA, {
        hostname: ' srv-01 ',
        ram_gb: '15,5',
        installed_on: '2026-03-04T10:00:00Z',
        os: 'Linux',
        virtual: 'true',
      }),
    ).toEqual({
      ok: true,
      value: {
        hostname: 'srv-01',
        ram_gb: 15.5,
        installed_on: '2026-03-04',
        os: 'Linux',
        virtual: true,
      },
    })
    expect(
      validateCiAttributes(SCHEMA, {
        hostname: 42,
        ram_gb: 8,
        virtual: false,
        os: '',
        installed_on: null,
      }),
    ).toEqual({
      ok: true,
      value: { hostname: '42', ram_gb: 8, virtual: false },
    })
  })

  it('reports each invalid value, unknown keys and missing required ones', () => {
    const result = validateCiAttributes(SCHEMA, {
      ram_gb: 'muito',
      installed_on: '04/03/2026',
      os: 'Mac',
      virtual: 'sim',
      extra: 1,
    })
    expect(result).toEqual({
      ok: false,
      issues: [
        { key: 'ram_gb', message: 'RAM (GB): Deve ser um número' },
        {
          key: 'installed_on',
          message: 'Instalado em: Deve ser uma data (AAAA-MM-DD)',
        },
        { key: 'os', message: 'SO: Opção inválida' },
        { key: 'virtual', message: 'Virtual: Deve ser verdadeiro ou falso' },
        { key: 'extra', message: 'Atributo não existe neste tipo' },
        { key: 'hostname', message: 'Hostname é obrigatório' },
      ],
    })
  })

  it('does not duplicate the required issue when the value itself is invalid', () => {
    const result = validateCiAttributes(SCHEMA, { hostname: true, ram_gb: {} })
    expect(result).toEqual({
      ok: false,
      issues: [
        { key: 'hostname', message: 'Hostname: Deve ser um texto' },
        { key: 'ram_gb', message: 'RAM (GB): Deve ser um número' },
      ],
    })
  })

  it('drops unknown keys when asked (type change)', () => {
    expect(
      validateCiAttributes(
        SCHEMA,
        { hostname: 'a', legacy: 'x' },
        { dropUnknown: true },
      ),
    ).toEqual({ ok: true, value: { hostname: 'a' } })
  })

  it('rejects impossible dates and selects without options', () => {
    const noOptions: SdCiAttributeDefinition[] = [
      { key: 's', label: 'S', type: 'select' },
      { key: 'd', label: 'D', type: 'date' },
    ]
    const result = validateCiAttributes(noOptions, { s: 'x', d: '2026-13-45' })
    expect(result.ok).toBe(false)
  })
})

describe('parseCiAttributeSchema()', () => {
  it('keeps only well-formed definitions', () => {
    expect(
      parseCiAttributeSchema([
        { key: 'a', label: 'A', type: 'text' },
        { key: 'b', label: 'B', type: 'weird' },
        { key: 1, label: 'C', type: 'text' },
        null,
        'x',
      ]),
    ).toEqual([{ key: 'a', label: 'A', type: 'text' }])
    expect(parseCiAttributeSchema({})).toEqual([])
  })
})
