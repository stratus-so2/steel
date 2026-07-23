import { describe, expect, it } from 'vitest'
import { createFakeCrmReport } from '@/src/__tests__/factories/crm-report.factory'
import { toCrmReportDTO } from '../crm-report.mapper'

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
})
