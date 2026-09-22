import { describe, expect, it, vi } from 'vitest'
import { createFakeSdCustomField } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/sd-custom-field.repository')

import { SdCustomFieldRepository } from '@/src/repositories/sd-custom-field.repository'
import { validateSdEntityCustomFields } from '../sd-entity-custom-fields'

const repo = vi.mocked(SdCustomFieldRepository)
const text = (key: string, extra = {}) =>
  createFakeSdCustomField({
    entity: 'CUSTOMER',
    key,
    label: key.toUpperCase(),
    type: 'TEXT',
    ...extra,
  })

describe('validateSdEntityCustomFields', () => {
  it('returns undefined without touching the definitions when nothing is sent', async () => {
    expect(
      expectOk(
        await validateSdEntityCustomFields('ws1', 'CUSTOMER', undefined),
      ),
    ).toBeUndefined()
    expect(repo.list).not.toHaveBeenCalled()
  })

  it('applies defaults and enforces required fields on create', async () => {
    repo.list.mockResolvedValue(
      ok([text('a', { required: true }), text('b', { defaultValue: 'x' })]),
    )
    expectErr(
      await validateSdEntityCustomFields('ws1', 'CUSTOMER', {}),
      'SD_CUSTOM_FIELD_INVALID',
    )
    expect(
      expectOk(
        await validateSdEntityCustomFields('ws1', 'CUSTOMER', { a: 'ok' }),
      ),
    ).toEqual({ a: 'ok', b: 'x' })
    expect(repo.list).toHaveBeenCalledWith('ws1', { entity: 'CUSTOMER' })
  })

  it('merges the sent keys over the stored value and drops cleared ones on update', async () => {
    repo.list.mockResolvedValue(ok([text('a', { required: true }), text('b')]))
    expect(
      expectOk(
        await validateSdEntityCustomFields(
          'ws1',
          'CUSTOMER',
          { b: null },
          { a: 'kept', b: 'old', legacy: 1 },
        ),
      ),
    ).toEqual({ a: 'kept', legacy: 1 })
  })

  it('treats a non-object stored value as empty', async () => {
    repo.list.mockResolvedValue(ok([text('b')]))
    expect(
      expectOk(
        await validateSdEntityCustomFields('ws1', 'CUSTOMER', { b: 'n' }, null),
      ),
    ).toEqual({ b: 'n' })
    expect(
      expectOk(
        await validateSdEntityCustomFields('ws1', 'CUSTOMER', { b: 'n' }, [1]),
      ),
    ).toEqual({ b: 'n' })
  })

  it('propagates validation and repository errors', async () => {
    repo.list.mockResolvedValue(ok([text('a', { required: true })]))
    expectErr(
      await validateSdEntityCustomFields('ws1', 'CUSTOMER', { a: null }, {}),
      'SD_CUSTOM_FIELD_INVALID',
    )
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await validateSdEntityCustomFields('ws1', 'CUSTOMER', {}),
      'DATABASE_ERROR',
    )
  })
})
