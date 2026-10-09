import { describe, expect, it } from 'vitest'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

async function html(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' })
  return { status: res.status, body: await res.text() }
}

// HTML attributes only: the RSC payload carries the same props as JSON.
const count = (body: string, needle: string) => body.split(needle).length - 1
const SHELL = 'data-web-shell=""'
const HEADER_NAV = 'aria-label="Principal"'
const FOOTER_NAV = 'aria-label="Rodapé"'

describe('site header and footer on public pages', () => {
  it.each([
    '/pricing',
    '/about',
    '/changelog',
    '/marketplace',
    '/talk-to-sales',
    '/docs',
    '/dev',
    '/legals/privacy',
    '/legals/terms',
    '/legals/security',
    '/legals/subprocessors',
    '/legals/trust/access-control',
    '/status',
    '/status/history',
  ])('%s renders exactly one header and one footer', async (path) => {
    const { status, body } = await html(path)
    expect(status).toBe(200)
    expect(count(body, SHELL)).toBe(1)
    expect(count(body, HEADER_NAV)).toBe(1)
    expect(count(body, FOOTER_NAV)).toBe(1)
  })

  it('an unknown docs page keeps the site frame', async () => {
    const { body } = await html('/docs/crm/nao-existe')
    expect(count(body, SHELL)).toBe(1)
    expect(body).toContain('Página não encontrada')
  })

  it.each([
    '/sign-in',
    '/sign-up',
    '/forget-password',
    '/reset-password',
    '/suporte/entrar/token-invalido',
    '/unsubscribe/token-invalido',
  ])('%s keeps its focused layout', async (path) => {
    const { body } = await html(path)
    expect(count(body, SHELL)).toBe(0)
    expect(count(body, FOOTER_NAV)).toBe(0)
  })
})
