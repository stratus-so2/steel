import { describe, expect, it } from 'vitest'
import {
  createFakeCrmDashboard,
  createFakeCrmDashboardWidget,
} from '@/src/__tests__/factories/crm-dashboard.factory'
import {
  toCrmDashboardDTO,
  toCrmDashboardWidgetDTO,
} from '../crm-dashboard.mapper'

describe('toCrmDashboardDTO()', () => {
  it('should map all fields correctly', () => {
    const dashboard = createFakeCrmDashboard({ id: 'd-1', title: 'Visão' })
    const dto = toCrmDashboardDTO(dashboard)
    expect(dto.id).toBe('d-1')
    expect(dto.title).toBe('Visão')
  })
})

describe('toCrmDashboardWidgetDTO()', () => {
  it('should map all fields correctly', () => {
    const widget = createFakeCrmDashboardWidget({ id: 'w-1', type: 'CHART' })
    const dto = toCrmDashboardWidgetDTO(widget)
    expect(dto.id).toBe('w-1')
    expect(dto.type).toBe('CHART')
  })
})
