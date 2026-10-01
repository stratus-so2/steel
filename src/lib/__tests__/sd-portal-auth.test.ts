import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

const cookieGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}))
vi.mock('@/src/services/sd-portal-access.service', () => ({
  SdPortalAccessService: { resolveSession: vi.fn() },
}))

import { sdPortalContactInactive } from '@/src/errors'
import { SdPortalAccessService } from '@/src/services/sd-portal-access.service'
import { SD_PORTAL_COOKIE } from '../servicedesk/portal-session'

const resolve = vi.mocked(SdPortalAccessService.resolveSession)

/**
 * `getSdPortalSession` é memoizado por requisição com `cache()` do React,
 * então cada caso importa o módulo de novo para ter o cache limpo.
 */
async function load() {
  vi.resetModules()
  const { getSdPortalSession } = await import('../servicedesk/portal-auth')
  return getSdPortalSession
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getSdPortalSession', () => {
  it('reads the portal cookie and resolves the session', async () => {
    cookieGet.mockReturnValue({ value: 'token-do-cookie' })
    const context = { contact: { id: 'contact1' } } as never
    resolve.mockResolvedValue(ok(context))

    const getSdPortalSession = await load()
    expect(expectOk(await getSdPortalSession())).toBe(context)
    expect(cookieGet).toHaveBeenCalledWith(SD_PORTAL_COOKIE)
    expect(resolve).toHaveBeenCalledWith('token-do-cookie')
  })

  it('never looks at the Better Auth cookie', async () => {
    cookieGet.mockReturnValue(undefined)
    const getSdPortalSession = await load()
    await getSdPortalSession()
    expect(cookieGet).toHaveBeenCalledTimes(1)
    expect(cookieGet).toHaveBeenCalledWith('sd.portal_session')
  })

  it('answers SD_PORTAL_SESSION_EXPIRED when there is no cookie', async () => {
    cookieGet.mockReturnValue(undefined)
    const getSdPortalSession = await load()

    const error = expectErr(
      await getSdPortalSession(),
      'SD_PORTAL_SESSION_EXPIRED',
    )
    expect(error.message).toContain('link do e-mail')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('propagates the error of the service', async () => {
    cookieGet.mockReturnValue({ value: 'token' })
    resolve.mockResolvedValue(err(sdPortalContactInactive()))

    const getSdPortalSession = await load()
    expectErr(await getSdPortalSession(), 'SD_PORTAL_CONTACT_INACTIVE')
  })

  it('gives the same answer on repeated calls in one request', async () => {
    cookieGet.mockReturnValue({ value: 'token' })
    const context = { contact: { id: 'c' } } as never
    resolve.mockResolvedValue(ok(context))

    const getSdPortalSession = await load()
    const first = expectOk(await getSdPortalSession())
    const second = expectOk(await getSdPortalSession())

    expect(first).toBe(context)
    expect(second).toBe(context)
  })
})
