import { describe, expect, it } from 'vitest'
import {
  CreateCrmNoteSchema,
  ListCrmNotesSchema,
  ReorderCrmNotesSchema,
  UpdateCrmNoteSchema,
} from '../crm-note.schema'

describe('CreateCrmNoteSchema', () => {
  it('should accept an empty payload', () => {
    expect(CreateCrmNoteSchema.safeParse({}).success).toBe(true)
  })

  it('should accept a full payload', () => {
    expect(
      CreateCrmNoteSchema.safeParse({
        title: 'Reunião',
        body: 'Notas da call',
        companyId: 'c1',
      }).success,
    ).toBe(true)
  })
})

describe('UpdateCrmNoteSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmNoteSchema.safeParse({}).success).toBe(true)
  })

  it('should accept null for clearable relation fields', () => {
    const result = UpdateCrmNoteSchema.safeParse({
      companyId: null,
      personId: null,
      opportunityId: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('ListCrmNotesSchema', () => {
  it('should accept optional filters', () => {
    expect(ListCrmNotesSchema.safeParse({ personId: 'p1' }).success).toBe(true)
  })
})

describe('ReorderCrmNotesSchema', () => {
  it('should require a non-empty orderedIds', () => {
    expect(ReorderCrmNotesSchema.safeParse({ orderedIds: [] }).success).toBe(
      false,
    )
  })

  it('should accept a valid orderedIds list', () => {
    expect(
      ReorderCrmNotesSchema.safeParse({ orderedIds: ['a', 'b'] }).success,
    ).toBe(true)
  })
})

describe('UpdateCrmNoteSchema — clearing optional fields', () => {
  it.each(['title', 'body'])('should accept null to clear %s', (field) => {
    const result = UpdateCrmNoteSchema.safeParse({ [field]: null })
    expect(result.success).toBe(true)
    expect((result.data as Record<string, unknown>)[field]).toBeNull()
  })

  it.each([
    'title',
    'body',
  ])('should normalize an emptied %s to null', (field) => {
    const result = UpdateCrmNoteSchema.safeParse({ [field]: '  ' })
    expect(result.success).toBe(true)
    expect((result.data as Record<string, unknown>)[field]).toBeNull()
  })

  it('should leave omitted optional fields undefined', () => {
    const result = UpdateCrmNoteSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('title')
  })
})
