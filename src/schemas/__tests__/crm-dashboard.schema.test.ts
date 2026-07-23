import { describe, expect, it } from 'vitest'
import {
  CreateCrmDashboardSchema,
  CreateCrmDashboardWidgetSchema,
  UpdateCrmDashboardSchema,
  UpdateCrmDashboardWidgetSchema,
} from '../crm-dashboard.schema'

describe('CreateCrmDashboardSchema', () => {
  it('should reject when title is missing', () => {
    expect(CreateCrmDashboardSchema.safeParse({}).success).toBe(false)
  })
})

describe('UpdateCrmDashboardSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmDashboardSchema.safeParse({}).success).toBe(true)
  })
})

describe('CreateCrmDashboardWidgetSchema', () => {
  it('should apply layout defaults', () => {
    const result = CreateCrmDashboardWidgetSchema.safeParse({ type: 'CHART' })
    expect(result.success).toBe(true)
    expect(result.data?.w).toBe(4)
    expect(result.data?.h).toBe(6)
  })

  it('should reject an invalid type', () => {
    expect(
      CreateCrmDashboardWidgetSchema.safeParse({ type: 'INVALID' }).success,
    ).toBe(false)
  })
})

describe('UpdateCrmDashboardWidgetSchema', () => {
  it('should accept a partial layout update', () => {
    expect(UpdateCrmDashboardWidgetSchema.safeParse({ x: 2 }).success).toBe(
      true,
    )
  })
})
