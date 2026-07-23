import { describe, expect, it } from 'vitest'
import {
  CreateCrmReportSchema,
  CrmReportQuerySchema,
  ReorderCrmReportsSchema,
  UpdateCrmReportSchema,
} from '../crm-report.schema'

describe('CreateCrmReportSchema', () => {
  it('should default filters to an empty array', () => {
    const result = CreateCrmReportSchema.safeParse({
      name: 'Pipeline por etapa',
      source: 'opportunity',
      columns: ['name', 'amount'],
    })
    expect(result.success).toBe(true)
    expect(result.data?.filters).toEqual([])
  })

  it('should reject an empty columns array', () => {
    const result = CreateCrmReportSchema.safeParse({
      name: 'Relatório',
      source: 'company',
      columns: [],
    })
    expect(result.success).toBe(false)
  })

  it('should reject an invalid source', () => {
    const result = CreateCrmReportSchema.safeParse({
      name: 'Relatório',
      source: 'invalid',
      columns: ['name'],
    })
    expect(result.success).toBe(false)
  })

  it('should accept an optional mega-query', () => {
    const result = CreateCrmReportSchema.safeParse({
      name: 'Relatório',
      source: 'company',
      columns: ['name'],
      query: {
        mode: 'join',
        datasets: [{ alias: 'company', source: 'company', filters: [] }],
        columns: ['company.name'],
      },
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateCrmReportSchema', () => {
  it('should leave filters undefined when omitted', () => {
    const result = UpdateCrmReportSchema.safeParse({ name: 'Novo nome' })
    expect(result.data?.filters).toBeUndefined()
  })

  it('should accept an explicit null query (volta ao modo legado)', () => {
    const result = UpdateCrmReportSchema.safeParse({ query: null })
    expect(result.success).toBe(true)
    expect(result.data?.query).toBeNull()
  })
})

describe('ReorderCrmReportsSchema', () => {
  it('should reject an empty orderedIds array', () => {
    expect(ReorderCrmReportsSchema.safeParse({ orderedIds: [] }).success).toBe(
      false,
    )
  })
})

describe('CrmReportQuerySchema', () => {
  it('should accept a join query with a single dataset', () => {
    const result = CrmReportQuerySchema.safeParse({
      mode: 'join',
      datasets: [{ alias: 'opportunity', source: 'opportunity', filters: [] }],
      columns: ['opportunity.name'],
    })
    expect(result.success).toBe(true)
  })

  it('should reject a union query with fewer than 2 datasets', () => {
    const result = CrmReportQuerySchema.safeParse({
      mode: 'union',
      datasets: [{ alias: 'lead', source: 'lead', filters: [] }],
      columns: [{ key: 'name', label: 'Nome', fields: { lead: 'name' } }],
    })
    expect(result.success).toBe(false)
  })

  it('should accept a union query with 2+ datasets and mapped columns', () => {
    const result = CrmReportQuerySchema.safeParse({
      mode: 'union',
      datasets: [
        { alias: 'lead', source: 'lead', filters: [] },
        { alias: 'person', source: 'person', filters: [] },
      ],
      columns: [
        {
          key: 'name',
          label: 'Nome',
          fields: { lead: 'name', person: 'name' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('should reject an invalid alias (uppercase/spaces)', () => {
    const result = CrmReportQuerySchema.safeParse({
      mode: 'join',
      datasets: [{ alias: 'Bad Alias', source: 'company', filters: [] }],
      columns: ['Bad Alias.name'],
    })
    expect(result.success).toBe(false)
  })
})
