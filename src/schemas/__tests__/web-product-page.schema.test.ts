import { SparklesIcon } from '@hugeicons-pro/core-stroke-rounded'
import { describe, expect, it } from 'vitest'
import {
  findProductPage,
  PRODUCT_PAGE_PATHS,
  PRODUCT_PAGES,
} from '@/src/config/web-product-pages'
import { slaPage } from '@/src/config/web-product-pages/sla'
import {
  type ProductPage,
  ProductPageSchema,
  ProductVisualSchema,
  productPagePath,
} from '@/src/schemas/web-product-page.schema'

/** Every string anywhere in a value, for the "no empty copy" check. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(strings)
  }
  return []
}

const objectPage = (): ProductPage => {
  const page = structuredClone(
    PRODUCT_PAGES.find((p) => p.template === 'object'),
  ) as ProductPage
  return page
}

describe('PRODUCT_PAGES content', () => {
  it('has the four modules and the seven capabilities, each once', () => {
    expect(PRODUCT_PAGE_PATHS).toEqual([
      '/product/servicedesk',
      '/product/crm',
      '/product/comunicacao',
      '/product/steel-ai',
      '/features/portal-do-solicitante',
      '/features/sla',
      '/features/base-de-conhecimento',
      '/features/cmdb',
      '/features/dashboards',
      '/features/campanhas',
      '/features/workflows',
    ])
    expect(new Set(PRODUCT_PAGE_PATHS).size).toBe(PRODUCT_PAGES.length)
  })

  it.each(PRODUCT_PAGES.map((page) => [productPagePath(page), page] as const))(
    '%s passes the schema with every block filled',
    (_path, page) => {
      const parsed = ProductPageSchema.safeParse(page)
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
      for (const text of strings(page)) expect(text.trim()).not.toBe('')
      expect(page.highlights.items).toHaveLength(3)
      expect(page.ai.items).toHaveLength(5)
      expect(page.details.items).toHaveLength(6)
      expect(page.connected.items.length).toBeGreaterThanOrEqual(3)
      if (page.template === 'rhythm') expect(page.rows).toHaveLength(2)
      else expect(page.rows).toBeUndefined()
    },
  )

  it('links connected items only to pages that exist', () => {
    const known = new Set<string>(PRODUCT_PAGE_PATHS)
    for (const page of PRODUCT_PAGES) {
      for (const item of page.connected.items) {
        expect(known.has(item.href), item.href).toBe(true)
        expect(item.href).not.toBe(productPagePath(page))
      }
    }
  })

  it('keeps public e-mail addresses on the company domain', () => {
    const text = PRODUCT_PAGES.flatMap(strings).join(' ')
    const outside = [...text.matchAll(/[\w.+-]+@([\w-]+\.)+\w+/g)]
      .map((match) => match[0])
      .filter((email) => !email.endsWith('@stratustelecom.com.br'))
    expect(outside).toEqual([])
  })

  it('finds a page by kind and slug', () => {
    expect(findProductPage('feature', 'sla')).toBe(slaPage)
    expect(findProductPage('product', 'sla')).toBeUndefined()
    expect(findProductPage('product', 'nope')).toBeUndefined()
  })
})

describe('ProductPageSchema', () => {
  it('requires the split rows on the rhythm template', () => {
    const page = { ...structuredClone(slaPage), rows: undefined }
    const parsed = ProductPageSchema.safeParse(page)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].path).toEqual(['rows'])
  })

  it('rejects split rows on the object template', () => {
    const page = { ...objectPage(), rows: structuredClone(slaPage.rows) }
    const parsed = ProductPageSchema.safeParse(page)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].message).toMatch(/não usa linhas/)
  })

  it('rejects a hero window whose active item is outside the menu', () => {
    const page = objectPage()
    page.hero.window.active = page.hero.window.nav.length
    const parsed = ProductPageSchema.safeParse(page)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].path).toEqual(['hero', 'window', 'active'])
  })

  it('rejects empty copy, wrong item counts and external links', () => {
    const blank = objectPage()
    blank.hero.title = '   '
    expect(ProductPageSchema.safeParse(blank).success).toBe(false)

    const short = objectPage()
    short.ai.items = short.ai.items.slice(0, 4)
    expect(ProductPageSchema.safeParse(short).success).toBe(false)

    const external = objectPage()
    external.connected.items[0].href = 'https://example.com'
    expect(ProductPageSchema.safeParse(external).success).toBe(false)
  })

  it('rejects an icon that is not an icon', () => {
    const page = objectPage()
    ;(page.details.items[0] as { icon: unknown }).icon = 'not-an-icon'
    expect(ProductPageSchema.safeParse(page).success).toBe(false)
    page.details.items[0].icon = SparklesIcon
    expect(ProductPageSchema.safeParse(page).success).toBe(true)
  })

  it('checks that every table row has one cell per column', () => {
    const table = {
      kind: 'table',
      columns: ['A', 'B'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    }
    expect(ProductVisualSchema.safeParse(table).success).toBe(true)
    const ragged = { ...table, rows: [['1'], ['3', '4']] }
    const parsed = ProductVisualSchema.safeParse(ragged)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].message).toMatch(/uma célula por coluna/)
  })

  it('keeps meter and chart values on a 0–100 scale', () => {
    expect(
      ProductVisualSchema.safeParse({
        kind: 'chart',
        title: 'x',
        variant: 'area',
        points: [1, 2, 3, 101],
      }).success,
    ).toBe(false)
    expect(
      ProductVisualSchema.safeParse({
        kind: 'meters',
        title: 'x',
        items: [{ label: 'a', value: -1, tone: 'brand' }],
      }).success,
    ).toBe(false)
  })
})

describe('productPagePath', () => {
  it('puts modules under /product and capabilities under /features', () => {
    expect(productPagePath({ kind: 'product', slug: 'crm' })).toBe(
      '/product/crm',
    )
    expect(productPagePath({ kind: 'feature', slug: 'sla' })).toBe(
      '/features/sla',
    )
  })
})
