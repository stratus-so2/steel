import { describe, expect, it } from 'vitest'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

async function page(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' })
  return { res, html: await res.text() }
}

const canonical = (html: string) =>
  /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]

describe('public docs, developer site and pricing', () => {
  it('serves the manual index without noindex', async () => {
    const { res, html } = await page('/docs')
    expect(res.status).toBe(200)
    expect(html).toContain('<title>Documentação | Steel</title>')
    expect(canonical(html)).toMatch(/\/docs$/)
    expect(html).not.toMatch(/<meta name="robots" content="noindex/)
    expect(html).toContain('href="/dev"')
  })

  it.each([
    ['/docs/comecando', 'Visão geral do Steel'],
    ['/docs/servicedesk/chamados', 'Chamados'],
    ['/docs/comunicacao/conexoes', 'Conexões (Meta e Z-API)'],
    ['/docs/steel-ai/modos', 'Modos Ask, Build, Autopilot e Teste'],
  ])('serves %s as a TechArticle', async (path, title) => {
    const { res, html } = await page(path)
    expect(res.status).toBe(200)
    expect(html).toContain(`<title>${title} | Documentação Steel</title>`)
    expect(canonical(html)).toMatch(new RegExp(`${path}$`))
    expect(html).toContain('"@type":"TechArticle"')
    expect(html).toContain('Nesta página')
  })

  it('answers 404 for an unknown manual page', async () => {
    const { res } = await page('/docs/crm/nao-existe')
    expect(res.status).toBe(404)
  })

  it('serves the developer landing and the API reference', async () => {
    const dev = await page('/dev')
    expect(dev.res.status).toBe(200)
    expect(dev.html).toContain('<title>Desenvolvedores | Steel</title>')
    expect(dev.html).toContain('href="/dev/api"')

    const api = await page('/dev/api')
    expect(api.res.status).toBe(200)
    expect(api.html).toContain('<title>Referência da API | Steel</title>')
    expect(api.html).toMatch(
      /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@scalar\/api-reference@[\d.]+\/[^"]+" integrity="sha384-/,
    )
    // Both scripts carry the request's CSP nonce.
    const nonce = /'nonce-([^']+)'/.exec(
      api.res.headers.get('content-security-policy') ?? '',
    )?.[1]
    expect(nonce).toBeTruthy()
    expect(api.html.match(new RegExp(`nonce="${nonce}"`, 'g'))).toHaveLength(2)
  })

  it('serves the public spec without the admin routes', async () => {
    const res = await fetch(`${BASE_URL}/dev/api/openapi.json`)
    expect(res.status).toBe(200)
    const spec = (await res.json()) as { paths: Record<string, unknown> }
    const paths = Object.keys(spec.paths)
    expect(paths.length).toBeGreaterThan(100)
    expect(paths.some((p) => p.startsWith('/admin'))).toBe(false)
  })

  it('redirects the old /reference address', async () => {
    const res = await fetch(`${BASE_URL}/reference`, { redirect: 'manual' })
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toMatch(/\/dev\/api$/)
  })

  it('serves /pricing with its metadata and the comparison', async () => {
    const { res, html } = await page('/pricing')
    expect(res.status).toBe(200)
    expect(html).toContain('<title>Planos e preços | Steel</title>')
    expect(canonical(html)).toMatch(/\/pricing$/)
    expect(html).toContain('Steel vs ServiceDesk')
    expect(html).toContain('"@type":"FAQPage"')
  })

  it('lists the manual and the developer site in sitemap.xml and llms.txt', async () => {
    const sitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text()
    expect(sitemap).toContain('/docs</loc>')
    expect(sitemap).toContain('/docs/servicedesk/chamados</loc>')
    expect(sitemap).toContain('/dev/api</loc>')

    const llms = await (await fetch(`${BASE_URL}/llms.txt`)).text()
    expect(llms).toContain('## Documentação (manual do usuário)')
  })
})
