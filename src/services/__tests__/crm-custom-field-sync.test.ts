import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmCustomFieldDefinition } from '@/src/__tests__/factories/crm-custom-field.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

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

const dbError = () => err(databaseError('boom'))

function fakeValue(recordId: string, definitionId: string, value: unknown) {
  return {
    id: `${recordId}-${definitionId}`,
    definitionId,
    recordId,
    value,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never
}

describe('applyCustomFieldValues() — coercion by type', () => {
  function withDefs(
    ...defs: ReturnType<typeof createFakeCrmCustomFieldDefinition>[]
  ) {
    mockedDefRepo.listByWorkspace.mockResolvedValue(ok(defs))
    mockedValueRepo.applyForRecord.mockResolvedValue(ok(undefined))
  }

  it('propagates definition lookup failures', async () => {
    mockedDefRepo.listByWorkspace.mockResolvedValue(dbError())
    expectErr(
      await applyCustomFieldValues('ws1', 'PERSON', 'p1', { d: 'x' }),
      'DATABASE_ERROR',
    )
    expect(mockedValueRepo.applyForRecord).not.toHaveBeenCalled()
  })

  it('scopes the definition lookup to the entity', async () => {
    withDefs()
    await applyCustomFieldValues('ws1', 'OPPORTUNITY', 'o1', { d: 'x' })
    expect(mockedDefRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
      entity: 'OPPORTUNITY',
    })
  })

  it('stores null for an empty optional field', async () => {
    withDefs(createFakeCrmCustomFieldDefinition({ id: 'd1', required: false }))
    expectOk(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', {
        d1: null,
      }),
    )
    expect(mockedValueRepo.applyForRecord).toHaveBeenCalledWith([
      { definitionId: 'd1', recordId: 'c1', value: null },
    ])
  })

  it('keeps native numbers, booleans, ISO dates, valid options and text', async () => {
    withDefs(
      createFakeCrmCustomFieldDefinition({ id: 'n', type: 'NUMBER' }),
      createFakeCrmCustomFieldDefinition({ id: 'b', type: 'BOOLEAN' }),
      createFakeCrmCustomFieldDefinition({ id: 'dt', type: 'DATE' }),
      createFakeCrmCustomFieldDefinition({
        id: 's',
        type: 'SELECT',
        options: ['A', 'B'],
      }),
      createFakeCrmCustomFieldDefinition({ id: 't', type: 'TEXT' }),
    )

    expectOk(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', {
        n: 7.5,
        b: 'yes',
        dt: '2026-01-02',
        s: 'B',
        t: 123,
      }),
    )
    expect(mockedValueRepo.applyForRecord).toHaveBeenCalledWith([
      { definitionId: 'n', recordId: 'c1', value: 7.5 },
      { definitionId: 'b', recordId: 'c1', value: true },
      {
        definitionId: 'dt',
        recordId: 'c1',
        value: new Date('2026-01-02').toISOString(),
      },
      { definitionId: 's', recordId: 'c1', value: 'B' },
      { definitionId: 't', recordId: 'c1', value: '123' },
    ])
  })

  it('rejects an invalid date', async () => {
    withDefs(createFakeCrmCustomFieldDefinition({ id: 'dt', type: 'DATE' }))
    const error = expectErr(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', {
        dt: 'not-a-date',
      }),
      'CRM_CUSTOM_FIELD_INVALID',
    )
    expect(error.message).toContain('data inválida')
    expect(mockedValueRepo.applyForRecord).not.toHaveBeenCalled()
  })

  it('propagates write failures', async () => {
    withDefs(createFakeCrmCustomFieldDefinition({ id: 't', type: 'TEXT' }))
    mockedValueRepo.applyForRecord.mockResolvedValue(dbError())
    expectErr(
      await applyCustomFieldValues('ws1', 'COMPANY', 'c1', { t: 'x' }),
      'DATABASE_ERROR',
    )
  })
})

describe('loadCustomFieldMaps() / withCustomFields*() — batches', () => {
  it('groups several values of the same record into one map', async () => {
    mockedValueRepo.listByRecords.mockResolvedValue(
      ok([
        fakeValue('c1', 'd1', 'A'),
        fakeValue('c1', 'd2', 2),
        fakeValue('c2', 'd1', 'B'),
      ]),
    )
    const maps = expectOk(await loadCustomFieldMaps(['c1', 'c2']))
    expect(maps.get('c1')).toEqual({ cf_d1: 'A', cf_d2: 2 })
    expect(maps.get('c2')).toEqual({ cf_d1: 'B' })
  })

  it('propagates listing failures', async () => {
    mockedValueRepo.listByRecords.mockResolvedValue(dbError())
    expectErr(await loadCustomFieldMaps(['c1']), 'DATABASE_ERROR')
    expectErr(await withCustomFields({ id: 'c1' }), 'DATABASE_ERROR')
    expectErr(await withCustomFieldsList([{ id: 'c1' }]), 'DATABASE_ERROR')
  })

  it('merges the values into a single record', async () => {
    mockedValueRepo.listByRecords.mockResolvedValue(
      ok([fakeValue('c1', 'd1', 'A')]),
    )
    const merged = expectOk(await withCustomFields({ id: 'c1' }))
    expect(merged.customFields).toEqual({ cf_d1: 'A' })
  })

  it('merges values into each DTO of a list, defaulting to {}', async () => {
    mockedValueRepo.listByRecords.mockResolvedValue(
      ok([fakeValue('c1', 'd1', 'A')]),
    )
    const merged = expectOk(
      await withCustomFieldsList([{ id: 'c1' }, { id: 'c2' }]),
    )
    expect(merged).toEqual([
      { id: 'c1', customFields: { cf_d1: 'A' } },
      { id: 'c2', customFields: {} },
    ])
    expect(mockedValueRepo.listByRecords).toHaveBeenCalledWith(['c1', 'c2'])
  })
})
