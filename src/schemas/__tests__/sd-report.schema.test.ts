import { describe, expect, it } from 'vitest'
import {
  CreateSdScheduledReportSchema,
  GenerateSdReportSchema,
  ListSdReportRunsSchema,
  ListSdScheduledReportsSchema,
  SdReportDownloadQuerySchema,
  UpdateSdScheduledReportSchema,
} from '@/src/schemas/sd-report.schema'

describe('CreateSdScheduledReportSchema', () => {
  it('applies the defaults of a monthly report', () => {
    const parsed = CreateSdScheduledReportSchema.parse({ name: 'SLA mensal' })

    expect(parsed).toEqual({
      name: 'SLA mensal',
      kind: 'SLA',
      customerIds: [],
      departmentIds: [],
      ticketTypes: [],
      period: 'LAST_MONTH',
      formats: ['PDF', 'CSV'],
      dayOfMonth: 1,
      atTime: '07:00',
      timezone: 'America/Sao_Paulo',
      recipients: [],
      includeAccountOwners: false,
      active: true,
    })
  })

  it('normalizes the recipients and dedupes the formats', () => {
    const parsed = CreateSdScheduledReportSchema.parse({
      name: 'SLA ACME',
      recipients: [' Gestor@Example.com ', 'ops@example.com'],
      formats: ['CSV', 'PDF', 'CSV'],
      dayOfMonth: '15',
    })

    expect(parsed.recipients).toEqual(['gestor@example.com', 'ops@example.com'])
    expect(parsed.formats).toEqual(['PDF', 'CSV'])
    expect(parsed.dayOfMonth).toBe(15)
  })

  it.each([
    ['an empty name', { name: '' }],
    ['a bad e-mail', { recipients: ['não-é-email'] }],
    ['no format', { formats: [] }],
    ['a day out of range', { dayOfMonth: 29 }],
    ['a malformed time', { atTime: '7h' }],
    ['a 24h time', { atTime: '24:00' }],
    ['an empty timezone', { timezone: '  ' }],
    ['an unknown period', { period: 'LAST_YEAR' }],
    ['an unknown format', { formats: ['XLSX'] }],
  ])('refuses %s', (_label, patch) => {
    const parsed = CreateSdScheduledReportSchema.safeParse({
      name: 'SLA mensal',
      ...patch,
    })

    expect(parsed.success).toBe(false)
  })
})

describe('UpdateSdScheduledReportSchema', () => {
  it('accepts a single field', () => {
    expect(UpdateSdScheduledReportSchema.parse({ active: false })).toEqual({
      active: false,
    })
  })

  it('refuses an empty payload', () => {
    const parsed = UpdateSdScheduledReportSchema.safeParse({})

    expect(parsed.success).toBe(false)
  })
})

describe('schemas de consulta', () => {
  it('reads includeInactive from the query string', () => {
    expect(
      ListSdScheduledReportsSchema.parse({ includeInactive: 'true' }),
    ).toEqual({ includeInactive: true })
    expect(ListSdScheduledReportsSchema.parse({})).toEqual({
      includeInactive: false,
    })
  })

  it('defaults and bounds the run history limit', () => {
    expect(ListSdReportRunsSchema.parse({})).toEqual({ limit: 50 })
    expect(ListSdReportRunsSchema.parse({ limit: '10' }).limit).toBe(10)
    expect(ListSdReportRunsSchema.safeParse({ limit: 500 }).success).toBe(false)
  })

  it('defaults the download format to PDF', () => {
    expect(SdReportDownloadQuerySchema.parse({})).toEqual({ format: 'PDF' })
    expect(SdReportDownloadQuerySchema.parse({ format: 'CSV' })).toEqual({
      format: 'CSV',
    })
    expect(
      SdReportDownloadQuerySchema.safeParse({ format: 'DOCX' }).success,
    ).toBe(false)
  })
})

describe('GenerateSdReportSchema', () => {
  it('accepts an empty body (report on demand with the defaults)', () => {
    expect(GenerateSdReportSchema.parse({})).toEqual({})
  })

  it('accepts a one-off scope and recipients', () => {
    const parsed = GenerateSdReportSchema.parse({
      period: 'LAST_30_DAYS',
      customerIds: ['cus1'],
      ticketTypes: ['INCIDENT'],
      formats: ['CSV'],
      recipients: ['Gestor@Example.com'],
    })

    expect(parsed).toEqual({
      period: 'LAST_30_DAYS',
      customerIds: ['cus1'],
      ticketTypes: ['INCIDENT'],
      formats: ['CSV'],
      recipients: ['gestor@example.com'],
    })
  })
})
