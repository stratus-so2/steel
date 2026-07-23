import { describe, expect, it } from 'vitest'
import { createFakeCrmTask } from '@/src/__tests__/factories/crm-task.factory'
import { toCrmTaskDTO } from '../crm-task.mapper'

describe('toCrmTaskDTO()', () => {
  it('should map all fields correctly', () => {
    const task = createFakeCrmTask({
      id: 't-1',
      title: 'Ligar',
      status: 'DONE',
    })
    const dto = toCrmTaskDTO(task)
    expect(dto.id).toBe('t-1')
    expect(dto.status).toBe('DONE')
  })

  it('should serialize dueDate as ISO string when present', () => {
    const task = createFakeCrmTask({
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
    })
    const dto = toCrmTaskDTO(task)
    expect(dto.dueDate).toBe('2026-08-01T00:00:00.000Z')
  })
})
