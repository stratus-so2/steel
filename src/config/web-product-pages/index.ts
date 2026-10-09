import {
  type ProductPage,
  productPagePath,
} from '@/src/schemas/web-product-page.schema'
import { servicedeskPage } from './servicedesk'
import { slaPage } from './sla'

/**
 * Every `/product/*` and `/features/*` page, in the order of the header's
 * Produto menu. The routes, the sitemap and `llms.txt` all read this list.
 */
export const PRODUCT_PAGES: ProductPage[] = [servicedeskPage, slaPage]

export function findProductPage(
  kind: ProductPage['kind'],
  slug: string,
): ProductPage | undefined {
  return PRODUCT_PAGES.find((page) => page.kind === kind && page.slug === slug)
}

export const PRODUCT_PAGE_PATHS = PRODUCT_PAGES.map(productPagePath)
