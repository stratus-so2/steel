import { describe, expect, it } from 'vitest'
import {
  createFakeCrmCustomFieldDefinition,
  createFakeCrmCustomFieldValue,
} from '@/src/__tests__/factories/crm-custom-field.factory'
import {
  toCrmCustomFieldDefinitionDTO,
  toCrmCustomFieldValueDTO,
} from '../crm-custom-field.mapper'

describe('toCrmCustomFieldDefinitionDTO()', () => {
  it('should map all fields correctly', () => {
    const definition = createFakeCrmCustomFieldDefinition({
      id: 'd-1',
      key: 'segment',
      type: 'SELECT',
      options: ['SMB', 'Enterprise'],
    })

    const dto = toCrmCustomFieldDefinitionDTO(definition)

    expect(dto.id).toBe('d-1')
    expect(dto.type).toBe('SELECT')
    expect(dto.options).toEqual(['SMB', 'Enterprise'])
  })
})

describe('toCrmCustomFieldValueDTO()', () => {
  it('should map all fields correctly', () => {
    const value = createFakeCrmCustomFieldValue({
      id: 'v-1',
      value: 'Enterprise',
    })

    const dto = toCrmCustomFieldValueDTO(value)

    expect(dto.id).toBe('v-1')
    expect(dto.value).toBe('Enterprise')
  })
})
