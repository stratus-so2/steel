import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  jsonResponse,
  mockFetch,
  textResponse,
  unreadableResponse,
} from '@/src/__tests__/helpers/fetch.helpers'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/src/cache/sd-cep.cache', () => ({
  SdCepCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

import { SdCepCache } from '@/src/cache/sd-cep.cache'
import {
  formatCep,
  lookupCep,
  normalizeCep,
  VIACEP_TIMEOUT_MS,
} from '@/src/lib/servicedesk/viacep'

const mockedCache = vi.mocked(SdCepCache)

const VIACEP_BODY = {
  cep: '01001-000',
  logradouro: 'Praça da Sé',
  complemento: 'lado ímpar',
  bairro: 'Sé',
  localidade: 'São Paulo',
  uf: 'sp',
  ibge: '3550308',
}

beforeEach(() => {
  mockedCache.get.mockResolvedValue(null)
  mockedCache.set.mockResolvedValue(undefined)
})

describe('servicedesk/viacep', () => {
  it('normalizes and formats CEPs', () => {
    expect(normalizeCep('01001-000')).toBe('01001000')
    expect(normalizeCep('01.001-000 99')).toBe('01001000')
    expect(formatCep('0100')).toBe('0100')
    expect(formatCep('01001000')).toBe('01001-000')
  })

  it('rejects an invalid CEP without calling ViaCEP', async () => {
    const fetch = mockFetch(() => jsonResponse({}))
    expectErr(await lookupCep('0100-100'), 'VALIDATION_ERROR')
    expectErr(await lookupCep('0100100A'), 'VALIDATION_ERROR')
    expect(fetch.spy).not.toHaveBeenCalled()
    expect(mockedCache.get).not.toHaveBeenCalled()
  })

  it('returns the mapped address and caches it', async () => {
    const fetch = mockFetch(() => jsonResponse(VIACEP_BODY))
    const address = expectOk(await lookupCep('01001-000'))

    expect(address).toEqual({
      zipCode: '01001000',
      street: 'Praça da Sé',
      complement: 'lado ímpar',
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      ibgeCode: '3550308',
    })
    expect(fetch.calls()[0].url).toBe('https://viacep.com.br/ws/01001000/json/')
    expect(fetch.calls()[0].init?.signal).toBeInstanceOf(AbortSignal)
    expect(mockedCache.set).toHaveBeenCalledWith('01001000', address)
    expect(VIACEP_TIMEOUT_MS).toBe(4000)
  })

  it('maps blank fields to null', async () => {
    mockFetch(() => jsonResponse({ cep: '01001-000', logradouro: '  ' }))
    const address = expectOk(await lookupCep('01001000'))
    expect(address).toEqual({
      zipCode: '01001000',
      street: null,
      complement: null,
      district: null,
      city: null,
      state: null,
      ibgeCode: null,
    })
  })

  it('serves cache hits without calling ViaCEP', async () => {
    const cached = {
      zipCode: '01001000',
      street: 'Praça da Sé',
      complement: null,
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      ibgeCode: '3550308',
    }
    mockedCache.get.mockResolvedValue(cached)
    const fetch = mockFetch(() => jsonResponse(VIACEP_BODY))

    expect(expectOk(await lookupCep('01001000'))).toBe(cached)
    expect(fetch.spy).not.toHaveBeenCalled()
  })

  it('returns SD_CEP_NOT_FOUND for {erro: true} and for HTTP 400', async () => {
    mockFetch(() => jsonResponse({ erro: 'true' }))
    expectErr(await lookupCep('99999999'), 'SD_CEP_NOT_FOUND')

    mockFetch(() => textResponse('bad request', { status: 400 }))
    expectErr(await lookupCep('99999999'), 'SD_CEP_NOT_FOUND')
    expect(mockedCache.set).not.toHaveBeenCalled()
  })

  it('returns SD_CEP_LOOKUP_FAILED on 5xx, network errors, timeouts and unreadable bodies', async () => {
    mockFetch(() => textResponse('down', { status: 503 }))
    expectErr(await lookupCep('01001000'), 'SD_CEP_LOOKUP_FAILED')

    mockFetch(() => {
      throw new TypeError('fetch failed')
    })
    expectErr(await lookupCep('01001000'), 'SD_CEP_LOOKUP_FAILED')

    mockFetch(() => {
      throw 'aborted'
    })
    expectErr(await lookupCep('01001000'), 'SD_CEP_LOOKUP_FAILED')

    mockFetch(() => unreadableResponse())
    expectErr(await lookupCep('01001000'), 'SD_CEP_LOOKUP_FAILED')
  })

  it('aborts after the configured timeout', async () => {
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('timeout', 'TimeoutError')),
          )
        }),
    )
    expectErr(
      await lookupCep('01001000', { timeoutMs: 10 }),
      'SD_CEP_LOOKUP_FAILED',
    )
  })
})
