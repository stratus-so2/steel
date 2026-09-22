import { describe, expect, it } from 'vitest'
import {
  CreateSdCategorySchema,
  expectedSdCategoryLevel,
  ListSdCategoriesSchema,
  UpdateSdCategorySchema,
} from '../sd-category.schema'
import {
  CreateSdClassificationSchema,
  ListSdClassificationsSchema,
  UpdateSdClassificationSchema,
} from '../sd-classification.schema'
import {
  CreateSdScaleItemSchema,
  SaveSdPriorityMatrixSchema,
  UpdateSdScaleItemSchema,
} from '../sd-priority.schema'
import {
  CreateSdTicketTemplateSchema,
  ListSdTicketTemplatesSchema,
  SdTicketTemplateDefaultsSchema,
  UpdateSdTicketTemplateSchema,
} from '../sd-ticket-template.schema'

describe('category schemas', () => {
  it('computes the expected level from the parent', () => {
    expect(expectedSdCategoryLevel(null)).toBe('CATEGORY')
    expect(expectedSdCategoryLevel('CATEGORY')).toBe('SUBCATEGORY')
    expect(expectedSdCategoryLevel('SUBCATEGORY')).toBe('SERVICE')
    expect(expectedSdCategoryLevel('SERVICE')).toBeNull()
  })

  it('applies defaults and dedupes ticket types', () => {
    expect(
      CreateSdCategorySchema.parse({
        level: 'CATEGORY',
        name: 'Rede',
        ticketTypes: ['INCIDENT', 'INCIDENT'],
      }),
    ).toEqual({
      level: 'CATEGORY',
      name: 'Rede',
      ticketTypes: ['INCIDENT'],
      portalVisible: true,
      active: true,
    })
    expect(
      CreateSdCategorySchema.safeParse({ level: 'X', name: 'Rede' }).success,
    ).toBe(false)
  })

  it('requires a field on update and parses list filters', () => {
    expect(UpdateSdCategorySchema.safeParse({}).success).toBe(false)
    expect(UpdateSdCategorySchema.parse({ ticketTypes: ['CHANGE'] })).toEqual({
      ticketTypes: ['CHANGE'],
    })
    expect(
      ListSdCategoriesSchema.parse({
        ticketType: 'PROBLEM',
        includeInactive: 'true',
      }),
    ).toEqual({ ticketType: 'PROBLEM', includeInactive: true })
  })
})

describe('classification schemas', () => {
  it('applies defaults', () => {
    expect(
      CreateSdClassificationSchema.parse({ kind: 'SOLUTION', name: 'Remoto' }),
    ).toEqual({
      kind: 'SOLUTION',
      name: 'Remoto',
      ticketTypes: [],
      active: true,
    })
  })

  it('validates update and list', () => {
    expect(UpdateSdClassificationSchema.safeParse({}).success).toBe(false)
    expect(
      UpdateSdClassificationSchema.parse({ ticketTypes: ['CHANGE', 'CHANGE'] }),
    ).toEqual({ ticketTypes: ['CHANGE'] })
    expect(ListSdClassificationsSchema.parse({ kind: 'TICKET' })).toEqual({
      kind: 'TICKET',
      includeInactive: false,
    })
  })
})

describe('priority scale schemas', () => {
  it('validates scale items', () => {
    expect(CreateSdScaleItemSchema.parse({ name: 'Alto', level: 3 })).toEqual({
      name: 'Alto',
      level: 3,
      isDefault: false,
    })
    expect(
      CreateSdScaleItemSchema.safeParse({ name: 'Alto', level: 0 }).success,
    ).toBe(false)
    expect(UpdateSdScaleItemSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdScaleItemSchema.parse({ level: 2 })).toEqual({ level: 2 })
  })

  it('rejects duplicated matrix cells', () => {
    const cell = { impactId: 'i', urgencyId: 'u', priorityId: 'p' }
    expect(SaveSdPriorityMatrixSchema.parse({ cells: [cell] })).toEqual({
      cells: [cell],
    })
    expect(
      SaveSdPriorityMatrixSchema.safeParse({
        cells: [cell, { ...cell, priorityId: 'p2' }],
      }).success,
    ).toBe(false)
  })
})

describe('ticket template schemas', () => {
  it('accepts partial defaults and rejects unknown keys', () => {
    expect(
      SdTicketTemplateDefaultsSchema.parse({
        title: ' Reset ',
        changeType: 'STANDARD',
        customFields: { a: 1 },
      }),
    ).toEqual({
      title: 'Reset',
      changeType: 'STANDARD',
      customFields: { a: 1 },
    })
    expect(SdTicketTemplateDefaultsSchema.safeParse({ foo: 1 }).success).toBe(
      false,
    )
    expect(
      SdTicketTemplateDefaultsSchema.safeParse({ changeRisk: 'HUGE' }).success,
    ).toBe(false)
  })

  it('applies create defaults', () => {
    expect(
      CreateSdTicketTemplateSchema.parse({
        ticketType: 'SERVICE_REQUEST',
        name: 'Admissão',
        tasks: [{ title: 'Criar usuário' }],
      }),
    ).toEqual({
      ticketType: 'SERVICE_REQUEST',
      name: 'Admissão',
      defaults: {},
      tasks: [{ title: 'Criar usuário' }],
      portalVisible: false,
      active: true,
    })
    expect(
      CreateSdTicketTemplateSchema.safeParse({
        ticketType: 'INCIDENT',
        name: 'x',
        tasks: [{ title: '' }],
      }).success,
    ).toBe(false)
  })

  it('validates update and list', () => {
    expect(UpdateSdTicketTemplateSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdTicketTemplateSchema.parse({ active: false })).toEqual({
      active: false,
    })
    expect(ListSdTicketTemplatesSchema.parse({ ticketType: 'CHANGE' })).toEqual(
      { ticketType: 'CHANGE', includeInactive: false },
    )
  })
})
