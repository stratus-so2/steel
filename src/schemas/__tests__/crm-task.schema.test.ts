import { describe, expect, it } from 'vitest'
import {
  CreateCrmTaskSchema,
  ListCrmTasksSchema,
  UpdateCrmTaskSchema,
} from '../crm-task.schema'

describe('CreateCrmTaskSchema', () => {
  it('should default status to TODO', () => {
    const result = CreateCrmTaskSchema.safeParse({ title: 'Ligar pro cliente' })
    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('TODO')
  })

  it('should reject when title is missing', () => {
    expect(CreateCrmTaskSchema.safeParse({}).success).toBe(false)
  })

  it('should coerce dueDate to a Date', () => {
    const result = CreateCrmTaskSchema.safeParse({
      title: 'Ligar',
      dueDate: '2026-08-01',
    })
    expect(result.data?.dueDate).toBeInstanceOf(Date)
  })
})

describe('UpdateCrmTaskSchema', () => {
  it('should leave status undefined when omitted', () => {
    const result = UpdateCrmTaskSchema.safeParse({ title: 'Novo título' })
    expect(result.data?.status).toBeUndefined()
  })
})

describe('ListCrmTasksSchema', () => {
  it('should accept optional filters', () => {
    expect(
      ListCrmTasksSchema.safeParse({ companyId: 'c1', status: 'DONE' }).success,
    ).toBe(true)
  })
})
