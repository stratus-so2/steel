import type {
  CrmLandingPageSectionContent,
  CrmLandingPageSectionType,
} from '@/src/schemas/crm-landing-page-section.schema'
import { agencyTemplate } from './agency'
import { b2bTemplate } from './b2b'
import { consultationTemplate } from './consultation'
import { coworkingTemplate } from './coworking'
import { ecommerceTemplate } from './ecommerce'
import { jobSiteTemplate } from './job-site'
import { mobileAppTemplate } from './mobile-app'
import { productTemplate } from './product'
import { saasSubscriptionTemplate } from './saas-subscription'
import { webApplicationTemplate } from './web-application'

/**
 * Um dos 10 modelos fixos e globais de landing page. Diferente de
 * `CrmProposalTemplate` (linha de banco, criada por workspace), esses são
 * definições estáticas versionadas no código — iguais pra todo mundo, sem
 * seed em runtime. A instância editável (`CrmLandingPage` + suas
 * `CrmLandingPageSection`) é semeada a partir de `sections` na criação.
 */
export type LandingPageTemplateSection = {
  type: CrmLandingPageSectionType
  content: CrmLandingPageSectionContent
}

export type LandingPageTemplateDefinition = {
  key: string
  name: string
  description: string
  sections: readonly LandingPageTemplateSection[]
}

export const LANDING_PAGE_TEMPLATE_CATALOG: Record<
  string,
  LandingPageTemplateDefinition
> = {
  agency: agencyTemplate,
  b2b: b2bTemplate,
  consultation: consultationTemplate,
  coworking: coworkingTemplate,
  ecommerce: ecommerceTemplate,
  'job-site': jobSiteTemplate,
  'mobile-app': mobileAppTemplate,
  product: productTemplate,
  'saas-subscription': saasSubscriptionTemplate,
  'web-application': webApplicationTemplate,
}

export const LANDING_PAGE_TEMPLATE_KEYS = Object.keys(
  LANDING_PAGE_TEMPLATE_CATALOG,
)

export function getLandingPageTemplate(
  key: string,
): LandingPageTemplateDefinition | undefined {
  return LANDING_PAGE_TEMPLATE_CATALOG[key]
}
