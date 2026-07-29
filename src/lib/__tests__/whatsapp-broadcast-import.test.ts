import { describe, expect, it } from 'vitest'
import {
  normalizePhone,
  parseBroadcastImportCsv,
  validateBroadcastImportRows,
} from '../whatsapp/broadcast-import'

describe('parseBroadcastImportCsv()', () => {
  it('should parse a well-formed CSV with variables', () => {
    const csv = [
      'telefone,nome,data_referencia,var_1,var_2',
      '11987654321,Maria,2026-08-15T09:00:00,Maria,15/08 às 09h',
      '5511912345678,João,2026-08-16T14:00:00,João,16/08 às 14h',
    ].join('\n')

    const { rows, parseErrors } = parseBroadcastImportCsv(csv)

    expect(parseErrors).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      phone: '11987654321',
      contactName: 'Maria',
      referenceDate: '2026-08-15T09:00:00',
      variables: ['Maria', '15/08 às 09h'],
    })
  })

  it('should handle quoted fields containing commas', () => {
    const csv = [
      'telefone,data_referencia,var_1',
      '"11987654321","2026-08-15","Rua A, 123"',
    ].join('\n')

    const { rows } = parseBroadcastImportCsv(csv)

    expect(rows[0].variables).toEqual(['Rua A, 123'])
  })

  it('should error when required headers are missing', () => {
    const csv = 'nome,var_1\nMaria,x'

    const { rows, parseErrors } = parseBroadcastImportCsv(csv)

    expect(rows).toEqual([])
    expect(parseErrors[0]).toMatch(/telefone/)
  })

  it('should error on an empty file', () => {
    const { parseErrors } = parseBroadcastImportCsv('')
    expect(parseErrors).toHaveLength(1)
  })

  it('should order var_N columns numerically regardless of header order', () => {
    const csv = [
      'telefone,data_referencia,var_2,var_1',
      '11987654321,2026-08-15,segundo,primeiro',
    ].join('\n')

    const { rows } = parseBroadcastImportCsv(csv)

    expect(rows[0].variables).toEqual(['primeiro', 'segundo'])
  })
})

describe('normalizePhone()', () => {
  it('should strip non-digit characters', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('5511987654321')
  })
})

describe('validateBroadcastImportRows()', () => {
  const baseRow = {
    phone: '11987654321',
    contactName: 'Maria',
    referenceDate: '2026-08-15T09:00:00.000Z',
    variables: ['Maria', 'amanhã'],
  }

  it('should accept a valid row and compute scheduledAt from the offset', () => {
    const { valid, rejected } = validateBroadcastImportRows([baseRow], 2, 24)

    expect(rejected).toEqual([])
    expect(valid).toHaveLength(1)
    expect(valid[0].phone).toBe('11987654321')
    expect(valid[0].variableValues).toEqual({
      body: { '1': 'Maria', '2': 'amanhã' },
    })
    expect(valid[0].scheduledAt.toISOString()).toBe('2026-08-14T09:00:00.000Z')
  })

  it('should reject an invalid phone number', () => {
    const { valid, rejected } = validateBroadcastImportRows(
      [{ ...baseRow, phone: 'abc' }],
      2,
      24,
    )

    expect(valid).toEqual([])
    expect(rejected[0].reason).toMatch(/Telefone inválido/)
  })

  it('should reject an invalid reference date', () => {
    const { rejected } = validateBroadcastImportRows(
      [{ ...baseRow, referenceDate: 'not-a-date' }],
      2,
      24,
    )

    expect(rejected[0].reason).toMatch(/Data de referência inválida/)
  })

  it('should reject a row with the wrong number of variables', () => {
    const { rejected } = validateBroadcastImportRows(
      [{ ...baseRow, variables: ['only-one'] }],
      2,
      24,
    )

    expect(rejected[0].reason).toMatch(/exige 2 variável/)
  })

  it('should reject a row with a blank variable', () => {
    const { rejected } = validateBroadcastImportRows(
      [{ ...baseRow, variables: ['Maria', ''] }],
      2,
      24,
    )

    expect(rejected[0].reason).toMatch(/em branco/)
  })

  it('should process multiple rows independently (partial success)', () => {
    const { valid, rejected } = validateBroadcastImportRows(
      [baseRow, { ...baseRow, phone: 'invalid' }],
      2,
      24,
    )

    expect(valid).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].rowNumber).toBe(2)
  })
})
