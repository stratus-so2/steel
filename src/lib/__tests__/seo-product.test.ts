import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))

import { crmPage } from '@/src/config/web-product-pages/crm'
import { slaPage } from '@/src/config/web-product-pages/sla'
import { productPageJsonLd, productPageMetadata } from '@/src/lib/seo/product'

describe('productPageMetadata', () => {
  it('uses the page copy, its canonical path and the shared social image', () => {
    expect(productPageMetadata(crmPage)).toMatchObject({
      title: crmPage.meta.title,
      description: crmPage.meta.description,
      alternates: { canonical: '/product/crm' },
      openGraph: { url: '/product/crm', images: ['/opengraph-image'] },
      twitter: { card: 'summary_large_image', images: ['/twitter-image'] },
    })
    expect(productPageMetadata(slaPage)).toMatchObject({
      alternates: { canonical: '/features/sla' },
    })
  })
})

describe('productPageJsonLd', () => {
  it('describes a module as a web page, a breadcrumb and an application', () => {
    const { '@graph': graph } = productPageJsonLd(crmPage)
    expect(graph.map((node) => node['@type'])).toEqual([
      'WebPage',
      'BreadcrumbList',
      'SoftwareApplication',
    ])
    expect(graph[0]).toMatchObject({
      url: 'https://steel.test/product/crm',
      isPartOf: { '@id': 'https://steel.test/#website' },
    })
    expect(graph[1]).toMatchObject({
      itemListElement: [
        { position: 1, name: 'Steel', item: 'https://steel.test' },
        { position: 2, name: 'Produto' },
        { position: 3, name: 'CRM', item: 'https://steel.test/product/crm' },
      ],
    })
    expect(graph[2]).toMatchObject({
      name: 'Steel CRM',
      featureList: crmPage.details.items.map((item) => item.title),
    })
  })

  it('describes a capability as a web page under "Recursos", without an application', () => {
    const { '@graph': graph } = productPageJsonLd(slaPage)
    expect(graph.map((node) => node['@type'])).toEqual([
      'WebPage',
      'BreadcrumbList',
    ])
    expect(graph[1]).toMatchObject({
      itemListElement: [{}, { name: 'Recursos' }, { name: 'SLA e OLA' }],
    })
  })
})
