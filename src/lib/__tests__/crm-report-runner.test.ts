import { describe, expect, it } from 'vitest'
import { isCrmReportSource } from '../crm-report-runner'

describe('isCrmReportSource()', () => {
  it('should accept known sources', () => {
    expect(isCrmReportSource('company')).toBe(true)
    expect(isCrmReportSource('person')).toBe(true)
    expect(isCrmReportSource('opportunity')).toBe(true)
    expect(isCrmReportSource('lead')).toBe(true)
  })

  it('should reject unknown sources', () => {
    expect(isCrmReportSource('invalid')).toBe(false)
  })
})
