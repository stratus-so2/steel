import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmCustomFieldDefinition } from '@/src/__tests__/factories/crm-custom-field.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-custom-field.repository')

import {
  CrmCustomFieldDefinitionRepository,
  CrmCustomFieldValueRepository,
} from '@/src/repositories/crm-custom-field.repository'
import {
  applyCustomFieldValues,
  loadCustomFieldMaps,
  withCustomFields,
  withCustomFieldsList,
} from '../crm-custom-field-sync'

const mockedDefRepo = vi.mocked(CrmCustomFieldDefinitionRepository)
const mockedValueRepo = vi.mocked(CrmCustomFieldValueRepository)

describe('applyCustomFieldValues()', () => {
  it('should do nothing when values is empty', async () => {
    expectOk(await applyCustomFieldValues('ws1', 'COMPANY', 'c1', {}))
    expect(mockedDefRepo.listByWorkspace).not.toHaveBeenCalled()
  })

  it('should ignore keys with no matching live definition', async () => {
    mockedDefRepo.listByWorkspace.mockResolvedValue(ok([]))
    mockedValueRepo.applyForRecord.mockResolvedValue(ok(undefined))

    expectOk(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', {
        'unknown-def': 'x',
      }),
    )
    expect(mockedValueRepo.applyForRecord).toHaveBeenCalledWith([])
  })

  it('should reject a required field left empty', async () => {
    const def = createFakeCrmCustomFieldDefinition({
      id: 'def1',
      required: true,
      label: 'Segmento',
    })
    mockedDefRepo.listByWorkspace.mockResolvedValue(ok([def]))

    expectErr(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', { def1: '' }),
      'CRM_CUSTOM_FIELD_INVALID',
    )
  })

  it('should reject a non-numeric value for a NUMBER field', async () => {
    const def = createFakeCrmCustomFieldDefinition({
      id: 'def1',
      type: 'NUMBER',
    })
    mockedDefRepo.listByWorkspace.mockResolvedValue(ok([def]))

    expectErr(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', {
        def1: 'not-a-number',
      }),
      'CRM_CUSTOM_FIELD_INVALID',
    )
  })

  it('should reject a SELECT value outside the defined options', async () => {
    const def = createFakeCrmCustomFieldDefinition({
      id: 'def1',
      type: 'SELECT',
      options: ['A', 'B'],
    })
    mockedDefRepo.listByWorkspace.mockResolvedValue(ok([def]))

    expectErr(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', { def1: 'C' }),
      'CRM_CUSTOM_FIELD_INVALID',
    )
  })

  it('should coerce and apply a valid value', async () => {
    const def = createFakeCrmCustomFieldDefinition({
      id: 'def1',
      type: 'NUMBER',
    })
    mockedDefRepo.listByWorkspace.mockResolvedValue(ok([def]))
    mockedValueRepo.applyForRecord.mockResolvedValue(ok(undefined))

    expectOk(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', { def1: '42' }),
    )
    expect(mockedValueRepo.applyForRecord).toHaveBeenCalledWith([
      { definitionId: 'def1', recordId: 'c1', value: 42 },
    ])
  })
})

describe('loadCustomFieldMaps()', () => {
  it('should group values by recordId with a cf_ prefix', async () => {
    mockedValueRepo.listByRecords.mockResolvedValue(
      ok([
        {
          id: 'v1',
          definitionId: 'def1',
          recordId: 'c1',
          value: 'Enterprise',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    )

    const maps = expectOk(await loadCustomFieldMaps(['c1']))
    expect(maps.get('c1')).toEqual({ cf_def1: 'Enterprise' })
  })
})

describe('withCustomFields()', () => {
  it('should merge an empty map when the record has no values', async () => {
    mockedValueRepo.listByRecords.mockResolvedValue(ok([]))

    const merged = expectOk(await withCustomFields({ id: 'c1', name: 'Acme' }))
    expect(merged.customFields).toEqual({})
  })
})

describe('withCustomFieldsList()', () => {
  it('should return an empty list without querying for no records', async () => {
    const merged = expectOk(await withCustomFieldsList([]))
    expect(merged).toEqual([])
    expect(mockedValueRepo.listByRecords).not.toHaveBeenCalled()
  })
})
