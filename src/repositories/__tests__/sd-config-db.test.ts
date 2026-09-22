import { describe, expect, it } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdDepartmentNotFound } from '@/src/errors'
import { sdDb, sdDbFind } from '../sd-config-db'

function prismaError(code: string) {
  return Object.assign(new Error(`prisma ${code}`), { code })
}

describe('sdDb', () => {
  it('wraps the value in ok', async () => {
    expect(expectOk(await sdDb('m', async () => 42))).toBe(42)
  })

  it('maps P2002 to SD_CONFIG_CONFLICT with the given message', async () => {
    const error = expectErr(
      await sdDb(
        'm',
        async () => {
          throw prismaError('P2002')
        },
        'Nível repetido',
      ),
      'SD_CONFIG_CONFLICT',
    )
    expect(error.message).toBe('Nível repetido')
  })

  it('maps P2025 to SD_CONFIG_NOT_FOUND', async () => {
    expectErr(
      await sdDb('m', async () => {
        throw prismaError('P2025')
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('maps anything else to DATABASE_ERROR', async () => {
    expectErr(
      await sdDb('m', async () => {
        throw new Error('boom')
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await sdDb('m', async () => {
        throw 'not an error'
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('sdDbFind', () => {
  it('returns the row', async () => {
    expect(expectOk(await sdDbFind('m', async () => ({ id: 'x' })))).toEqual({
      id: 'x',
    })
  })

  it('turns null into SD_CONFIG_NOT_FOUND by default or the given error', async () => {
    expectErr(await sdDbFind('m', async () => null), 'SD_CONFIG_NOT_FOUND')
    expectErr(
      await sdDbFind('m', async () => null, sdDepartmentNotFound()),
      'SD_DEPARTMENT_NOT_FOUND',
    )
  })

  it('propagates errors', async () => {
    expectErr(
      await sdDbFind('m', async () => {
        throw new Error('boom')
      }),
      'DATABASE_ERROR',
    )
  })
})
