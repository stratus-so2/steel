import type { Metadata } from 'next'
import {
  type ProductPage,
  productPagePath,
} from '@/src/schemas/web-product-page.schema'
import { publicPageMetadata } from './metadata'
import { SITE_NAME, SITE_URL } from './site'

/** Metadata of a product or capability page: canonical, OG and Twitter. */
export function productPageMetadata(page: ProductPage): Metadata {
  return publicPageMetadata({
    title: page.meta.title,
    description: page.meta.description,
    path: productPagePath(page),
  })
}

/**
 * Structured data of a product or capability page: the web page itself, its
 * breadcrumb (Steel › Produto|Recursos › page) and, for the four modules, the
 * module as a feature of the Steel application.
 */
export function productPageJsonLd(page: ProductPage) {
  const url = `${SITE_URL}${productPagePath(page)}`
  const section = page.kind === 'product' ? 'Produto' : 'Recursos'

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: page.meta.title,
      description: page.meta.description,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: section },
        { '@type': 'ListItem', position: 3, name: page.label, item: url },
      ],
    },
  ]

  if (page.kind === 'product') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: `${SITE_NAME} ${page.label}`,
      url,
      description: page.meta.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: 'pt-BR',
      isPartOf: {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        url: SITE_URL,
      },
      publisher: { '@id': `${SITE_URL}/#organization` },
      featureList: page.details.items.map((item) => item.title),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}
