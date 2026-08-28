import type { ComponentType } from 'react'
import type { CrmLandingPageSectionType } from '@/src/schemas/crm-landing-page-section.schema'
import { AboutSection, aboutDefaultContent } from './about'
import { AGENCY_SECTION_OVERRIDES } from './agency/registry'
import { B2B_SECTION_OVERRIDES } from './b2b/registry'
import { FactsSection, factsDefaultContent } from './facts'
import { FaqSection, faqDefaultContent } from './faq'
import { FeaturesSection, featuresDefaultContent } from './features'
import { FooterSection, footerDefaultContent } from './footer'
import { HeaderSection, headerDefaultContent } from './header'
import { HeroSection, heroDefaultContent } from './hero'
import { JOB_SITE_SECTION_OVERRIDES } from './job-site/registry'
import { LogosSection, logosDefaultContent } from './logos'
import { NewsletterSection, newsletterDefaultContent } from './newsletter'
import { PricingSection, pricingDefaultContent } from './pricing'
import { ProductsSection, productsDefaultContent } from './products'
import { SAAS_SUBSCRIPTION_SECTION_OVERRIDES } from './saas-subscription/registry'
import { ServicesSection, servicesDefaultContent } from './services'
import { StepsSection, stepsDefaultContent } from './steps'
import { TestimonialSection, testimonialDefaultContent } from './testimonial'
import type { LandingPageSectionProps } from './types'
import { WorksSection, worksDefaultContent } from './works'

type AnyComponent = ComponentType<LandingPageSectionProps>

export type SectionDefinition = {
  type: CrmLandingPageSectionType
  label: string
  Component: AnyComponent
  createDefaultContent: () => LandingPageSectionProps['content']
}

// Componentes tipados por conteúdo discriminado (Extract<..., {type}>),
// unificados aqui só pra guardar num registry indexado por `type` — o call
// site sempre casa Component com content do mesmo tipo.
function def(
  type: CrmLandingPageSectionType,
  label: string,
  Component: ComponentType<any>,
  createDefaultContent: () => any,
): SectionDefinition {
  return { type, label, Component, createDefaultContent }
}

/**
 * Componentes genéricos — usados por qualquer template que ainda não tenha
 * uma versão pixel-perfect própria (ver `getSectionDefinition`).
 */
export const SECTION_REGISTRY: Record<
  CrmLandingPageSectionType,
  SectionDefinition
> = {
  HEADER: def('HEADER', 'Cabeçalho', HeaderSection, headerDefaultContent),
  HERO: def('HERO', 'Destaque', HeroSection, heroDefaultContent),
  SERVICES: def(
    'SERVICES',
    'Serviços',
    ServicesSection,
    servicesDefaultContent,
  ),
  TESTIMONIAL: def(
    'TESTIMONIAL',
    'Depoimento',
    TestimonialSection,
    testimonialDefaultContent,
  ),
  ABOUT: def('ABOUT', 'Sobre', AboutSection, aboutDefaultContent),
  FACTS: def('FACTS', 'Números', FactsSection, factsDefaultContent),
  FEATURES: def(
    'FEATURES',
    'Diferenciais',
    FeaturesSection,
    featuresDefaultContent,
  ),
  WORKS: def('WORKS', 'Projetos', WorksSection, worksDefaultContent),
  FOOTER: def('FOOTER', 'Rodapé', FooterSection, footerDefaultContent),
  PRICING: def('PRICING', 'Preços', PricingSection, pricingDefaultContent),
  FAQ: def('FAQ', 'Perguntas frequentes', FaqSection, faqDefaultContent),
  STEPS: def('STEPS', 'Como funciona', StepsSection, stepsDefaultContent),
  NEWSLETTER: def(
    'NEWSLETTER',
    'Newsletter',
    NewsletterSection,
    newsletterDefaultContent,
  ),
  LOGOS: def('LOGOS', 'Logos', LogosSection, logosDefaultContent),
  PRODUCTS: def(
    'PRODUCTS',
    'Produtos',
    ProductsSection,
    productsDefaultContent,
  ),
}

/**
 * Overrides pixel-perfect por template — só entra aqui quem já tem seção
 * portada 1:1 do Figma (ver `sections/<template>/registry.tsx`). Templates
 * sem override (ou seções ainda não portadas dentro de um template) caem
 * pro componente genérico do `SECTION_REGISTRY` acima.
 */
const TEMPLATE_OVERRIDES: Partial<
  Record<string, Partial<Record<CrmLandingPageSectionType, SectionDefinition>>>
> = {
  agency: AGENCY_SECTION_OVERRIDES,
  b2b: B2B_SECTION_OVERRIDES,
  'job-site': JOB_SITE_SECTION_OVERRIDES,
  'saas-subscription': SAAS_SUBSCRIPTION_SECTION_OVERRIDES,
}

/** Resolve a definição de seção pro template — override pixel-perfect se
 * existir, senão cai pro componente genérico. */
export function getSectionDefinition(
  templateKey: string,
  type: CrmLandingPageSectionType,
): SectionDefinition {
  return TEMPLATE_OVERRIDES[templateKey]?.[type] ?? SECTION_REGISTRY[type]
}
