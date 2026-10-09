import {
  type ProductPage,
  productPagePath,
} from '@/src/schemas/web-product-page.schema'
import { knowledgeBasePage } from './base-de-conhecimento'
import { campaignsPage } from './campanhas'
import { cmdbPage } from './cmdb'
import { comunicacaoPage } from './comunicacao'
import { crmPage } from './crm'
import { dashboardsPage } from './dashboards'
import { portalPage } from './portal'
import { servicedeskPage } from './servicedesk'
import { slaPage } from './sla'
import { steelAiPage } from './steel-ai'
import { workflowsPage } from './workflows'

/**
 * Every `/product/*` and `/features/*` page, in the order of the header's
 * Produto menu. The routes, the sitemap and `llms.txt` all read this list.
 */
export const PRODUCT_PAGES: ProductPage[] = [
  servicedeskPage,
  crmPage,
  comunicacaoPage,
  steelAiPage,
  portalPage,
  slaPage,
  knowledgeBasePage,
  cmdbPage,
  dashboardsPage,
  campaignsPage,
  workflowsPage,
]

export function findProductPage(
  kind: ProductPage['kind'],
  slug: string,
): ProductPage | undefined {
  return PRODUCT_PAGES.find((page) => page.kind === kind && page.slug === slug)
}

export const PRODUCT_PAGE_PATHS = PRODUCT_PAGES.map(productPagePath)
