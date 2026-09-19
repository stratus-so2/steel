import { describe, expect, it } from 'vitest'
import { createFakeCrmReport } from '@/src/__tests__/factories/crm-report.factory'
import { legacyToQuery, toCrmReportDTO } from '../crm-report.mapper'

describe('toCrmReportDTO()', () => {
  it('should map all fields correctly', () => {
    const report = createFakeCrmReport({
      id: 'r-1',
      columns: ['name', 'amount'],
    })
    const dto = toCrmReportDTO(report)
    expect(dto.id).toBe('r-1')
    expect(dto.columns).toEqual(['name', 'amount'])
  })

  it('should pass through a stored mega-query untouched', () => {
    const query = {
      mode: 'join' as const,
      datasets: [{ alias: 'company', source: 'company' as const, filters: [] }],
      joins: [],
      columns: ['company.name'],
    }
    const report = createFakeCrmReport({ query })
    const dto = toCrmReportDTO(report)
    expect(dto.query).toEqual(query)
  })

  it('should synthesize a query from legacy fields when query is null', () => {
    const report = createFakeCrmReport({
      source: 'opportunity',
      columns: ['name', 'amount'],
      filters: [{ field: 'name', operator: 'contains', value: 'x' }],
      groupBy: null,
      sort: null,
      query: null,
    })
    const dto = toCrmReportDTO(report)
    expect(dto.query).toEqual({
      mode: 'join',
      datasets: [
        {
          alias: 'opportunity',
          source: 'opportunity',
          filters: [{ field: 'name', operator: 'contains', value: 'x' }],
        },
      ],
      joins: [],
      columns: ['opportunity.name', 'opportunity.amount'],
      group: undefined,
      sort: undefined,
    })
  })
})

describe('legacyToQuery()', () => {
  it('should namespace groupBy into a count aggregation', () => {
    const report = createFakeCrmReport({
      source: 'lead',
      columns: ['name'],
      groupBy: 'status',
      sort: { field: 'count', direction: 'desc' },
    })
    const query = legacyToQuery(report)
    expect(query).toEqual({
      mode: 'join',
      datasets: [{ alias: 'lead', source: 'lead', filters: [] }],
      joins: [],
      columns: ['lead.name'],
      group: {
        by: ['lead.status'],
        aggregations: [{ fn: 'count', alias: 'count' }],
      },
      sort: { field: 'count', direction: 'desc' },
    })
  })

  it('should namespace a plain column sort by the report source', () => {
    const report = createFakeCrmReport({
      source: 'lead',
      columns: ['name', 'createdAt'],
      groupBy: null,
      sort: { field: 'createdAt', direction: 'asc' },
    })

    expect(legacyToQuery(report).sort).toEqual({
      field: 'lead.createdAt',
      direction: 'asc',
    })
  })

  it('should treat null legacy columns and filters as empty', () => {
    const report = createFakeCrmReport({
      source: 'lead',
      columns: null as never,
      filters: null as never,
      groupBy: null,
      sort: null,
      query: null as never,
    })

    const dto = toCrmReportDTO(report)

    expect(dto.columns).toEqual([])
    expect(dto.filters).toEqual([])
    expect(dto.query).toEqual(
      expect.objectContaining({
        columns: [],
        datasets: [{ alias: 'lead', source: 'lead', filters: [] }],
      }),
    )
  })
})
