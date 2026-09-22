import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { forbidden, sdCepNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/sd-access')
vi.mock('@/src/lib/servicedesk/viacep')

import { lookupCep } from '@/src/lib/servicedesk/viacep'
import { SdAccess } from '../sd-access'
import { SdCepService } from '../sd-cep.service'

const mockedAccess = vi.mocked(SdAccess)
const mockedLookup = vi.mocked(lookupCep)

const ADDRESS = {
  zipCode: '01001000',
  street: 'Praça da Sé',
  complement: null,
  district: 'Sé',
  city: 'São Paulo',
  state: 'SP',
  ibgeCode: '3550308',
}

beforeEach(() => {
  mockedAccess.resolve.mockResolvedValue(ok({} as never))
})

describe('SdCepService.lookup', () => {
  it('denies non-members before hitting ViaCEP', async () => {
    mockedAccess.resolve.mockResolvedValue(err(forbidden()))
    expectErr(await SdCepService.lookup('u1', 'ws1', '01001000'), 'FORBIDDEN')
    expect(mockedLookup).not.toHaveBeenCalled()
  })

  it('returns the address for a module member (requester or agent)', async () => {
    mockedLookup.mockResolvedValue(ok(ADDRESS))
    expect(
      expectOk(await SdCepService.lookup('u1', 'ws1', '01001-000')),
    ).toEqual(ADDRESS)
    expect(mockedAccess.resolve).toHaveBeenCalledWith('u1', 'ws1')
    expect(mockedLookup).toHaveBeenCalledWith('01001-000')
  })

  it('propagates lookup errors', async () => {
    mockedLookup.mockResolvedValue(err(sdCepNotFound()))
    expectErr(
      await SdCepService.lookup('u1', 'ws1', '99999999'),
      'SD_CEP_NOT_FOUND',
    )
  })
})
