import { describe, expect, it } from 'vitest'
import {
  CreateSdSavedViewSchema,
  UpdateSdSavedViewSchema,
} from '../sd-saved-view.schema'

describe('CreateSdSavedViewSchema', () => {
  it('applies defaults', () => {
    expect(CreateSdSavedViewSchema.parse({ name: ' Fila ' })).toEqual({
      name: 'Fila',
      mode: 'KANBAN',
      filters: {},
      sort: [],
      columns: [],
      shared: false,
    })
  })

  it('validates filters, sort and columns', () => {
    expect(
      CreateSdSavedViewSchema.safeParse({
        name: 'x',
        filters: { phaseIds: ['a'], includeClosed: true, n: 1, q: null },
        sort: [{ field: 'createdAt', order: 'asc' }],
        columns: ['title'],
        ticketType: 'INCIDENT',
      }).success,
    ).toBe(true)
    const tooMany = Object.fromEntries(
      Array.from({ length: 51 }, (_, i) => [`k${i}`, 'v']),
    )
    expect(
      CreateSdSavedViewSchema.safeParse({ name: 'x', filters: tooMany })
        .success,
    ).toBe(false)
    expect(
      CreateSdSavedViewSchema.safeParse({
        name: 'x',
        sort: [{ field: 'a', order: 'up' }],
      }).success,
    ).toBe(false)
    expect(CreateSdSavedViewSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('UpdateSdSavedViewSchema', () => {
  it('requires a field', () => {
    expect(UpdateSdSavedViewSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdSavedViewSchema.safeParse({ shared: true }).success).toBe(
      true,
    )
  })
})
