import type { MetadataRoute } from 'next'
import { PRODUCT_PAGES } from '@/src/config/web-product-pages'
import { getAllEntriesMeta } from '@/src/lib/changelog/entries'
import { getAllDevPagesMeta } from '@/src/lib/dev/pages'
import { getAllDocsMeta } from '@/src/lib/docs/pages'
import { SITE_URL } from '@/src/lib/seo/site'
import { productPagePath } from '@/src/schemas/web-product-page.schema'

type ChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]['changeFrequency']
>

interface StaticRoute {
  path: string
  priority: number
  changeFrequency: ChangeFrequency
}

// priority and changeFrequency are ignored by Google, but other engines
// (e.g. Bing) still read them and they cost nothing. lastModified (the
// changelog entries below) is the field Google actually uses. There is no
// home: "/" redirects to /sign-in, so it is left out. The manual's pages
// (/docs/**), the developer guides (/dev/**) and the product and capability
// pages come from their content configs below.
const STATIC_ROUTES: StaticRoute[] = [
  { path: '/sign-in', priority: 1, changeFrequency: 'monthly' },
  ...PRODUCT_PAGES.map((page) => ({
    path: productPagePath(page),
    priority: page.kind === 'product' ? 0.9 : 0.8,
    changeFrequency: 'monthly' as ChangeFrequency,
  })),
  { path: '/changelog', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/docs', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/dev', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/dev/api', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/manifesto', priority: 0.7, changeFrequency: 'yearly' },
  { path: '/pricing', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/marketplace', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/talk-to-sales', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/sign-up', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/status', priority: 0.4, changeFrequency: 'daily' },
  { path: '/status/history', priority: 0.3, changeFrequency: 'weekly' },
  { path: '/legals/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legals/terms', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legals/security', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legals/subprocessors', priority: 0.2, changeFrequency: 'yearly' },
  ...[
    'access-control',
    'data-retention',
    'disaster-recovery',
    'incident-management',
    'information-security',
    'vendor-management',
  ].map((slug) => ({
    path: `/legals/trust/${slug}`,
    priority: 0.2,
    changeFrequency: 'yearly' as ChangeFrequency,
  })),
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, docs, dev] = await Promise.all([
    getAllEntriesMeta(),
    getAllDocsMeta(),
    getAllDevPagesMeta(),
  ])

  return [
    ...STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
      url: `${SITE_URL}${path}`,
      priority,
      changeFrequency,
    })),
    ...docs.map((page) => ({
      url: `${SITE_URL}${page.href}`,
      priority: page.slug === 'index' ? 0.7 : 0.6,
      changeFrequency: 'monthly' as ChangeFrequency,
    })),
    ...dev.map((page) => ({
      url: `${SITE_URL}${page.href}`,
      priority: 0.5,
      changeFrequency: 'monthly' as ChangeFrequency,
    })),
    ...entries.map((entry) => ({
      url: `${SITE_URL}/changelog/${entry.slug}`,
      lastModified: entry.date,
      priority: 0.6,
      changeFrequency: 'yearly' as ChangeFrequency,
    })),
  ]
}
