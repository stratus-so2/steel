import { describe, expect, it } from 'vitest'
import {
  CreateCrmReportSchema,
  ReorderCrmReportsSchema,
  UpdateCrmReportSchema,
} from '../crm-report.schema'

describe('CreateCrmReportSchema', () => {
  it('should default filters to an empty object', () => {
    const result = CreateCrmReportSchema.safeParse({
      name: 'Pipeline por etapa',
      source: 'opportunity',
      columns: ['name', 'amount'],
    })
    expect(result.success).toBe(true)
    expect(result.data?.filters).toEqual({})
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
})

describe('UpdateCrmReportSchema', () => {
  it('should leave filters undefined when omitted', () => {
    const result = UpdateCrmReportSchema.safeParse({ name: 'Novo nome' })
    expect(result.data?.filters).toBeUndefined()
  })
})

describe('ReorderCrmReportsSchema', () => {
  it('should reject an empty orderedIds array', () => {
    expect(ReorderCrmReportsSchema.safeParse({ orderedIds: [] }).success).toBe(
      false,
    )
  })
})
