import { describe, expect, it } from 'vitest'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { PRODUCT_PAGES } from '@/src/config/web-product-pages'
import { productPagePath } from '@/src/schemas/web-product-page.schema'

const PAGES = [
  ...PRODUCT_PAGES.map((page) => ({
    path: productPagePath(page),
    title: page.meta.title,
    jsonLd: true,
  })),
  {
    path: '/marketplace',
    title: 'Marketplace de integrações | Steel',
    jsonLd: false,
  },
]

const decodeEntities = (html: string) =>
  html.replaceAll('&amp;', '&').replaceAll('&#x27;', "'")

// Anonymous visitors: these pages are public (proxy PUBLIC_ROUTES) and must
// render without a session. With Cache Components the status stays 200 even
// when notFound() fires, so the 404 marker is checked as well.
describe('public product pages', () => {
  it.each(PAGES)(
    '$path renders 200 with its title, canonical and social image',
    async ({ path, title, jsonLd }) => {
      const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' })
      expect(res.status).toBe(200)

      const html = decodeEntities(await res.text())
      expect(html).not.toContain('NEXT_HTTP_ERROR_FALLBACK;404')
      expect(html).toContain(`<title>${title}</title>`)
      expect(html).toMatch(
        new RegExp(`<link rel="canonical" href="[^"]*${path}"`),
      )
      expect(html).toMatch(/<meta property="og:image" content="[^"]+"/)
      if (jsonLd) expect(html).toContain('"BreadcrumbList"')
    },
  )

  it('answers an unknown slug with the not-found page', async () => {
    const res = await fetch(`${BASE_URL}/features/nao-existe`, {
      redirect: 'manual',
    })
    const html = await res.text()
    expect(
      res.status === 404 || html.includes('NEXT_HTTP_ERROR_FALLBACK;404'),
    ).toBe(true)
  })

  it('lists every page in the sitemap and in llms.txt', async () => {
    const sitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text()
    const llms = await (await fetch(`${BASE_URL}/llms.txt`)).text()
    for (const { path } of PAGES) {
      expect(sitemap).toMatch(new RegExp(`<loc>[^<]*${path}</loc>`))
      expect(llms).toContain(path)
    }
  })
})
