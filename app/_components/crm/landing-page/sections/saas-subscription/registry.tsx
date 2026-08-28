import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { factsDefaultContent, SaasSubscriptionFacts } from './facts'
import { faqDefaultContent, SaasSubscriptionFaq } from './faq'
import { featuresDefaultContent, SaasSubscriptionFeatures } from './features'
import { footerDefaultContent, SaasSubscriptionFooter } from './footer'
import { headerDefaultContent, SaasSubscriptionHeader } from './header'
import { heroDefaultContent, SaasSubscriptionHero } from './hero'
import { pricingDefaultContent, SaasSubscriptionPricing } from './pricing'
import {
  SaasSubscriptionSteps,
  stepsGettingStartedDefaultContent,
} from './steps'
import {
  SaasSubscriptionTestimonial,
  testimonialDefaultContent,
} from './testimonial'

// Mesma checagem solta que `../registry`'s `def()` usa: cada componente é
// tipado pro seu content discriminado (Extract<..., {type}>), incompatível
// por variância com o `ComponentType<LandingPageSectionProps>` genérico do
// registry — o call site sempre casa Component com content do mesmo tipo.
function entry(
  type: SectionDefinition['type'],
  label: string,
  Component: ComponentType<any>,
  createDefaultContent: () => any,
): SectionDefinition {
  return { type, label, Component, createDefaultContent }
}

/**
 * Overrides pixel-perfect do template SaaS Subscription, por tipo de seção.
 * STEPS é reaproveitado duas vezes no template (ver `saas-subscription.ts`):
 * "Content 01" (texto+imagem+CTA, `items` vazio) e "Content 02" (lista
 * numerada de passos) — o mesmo `SaasSubscriptionSteps` decide o layout com
 * base em `items.length`, então uma única entrada aqui cobre os dois usos.
 */
export const SAAS_SUBSCRIPTION_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry(
    'HEADER',
    'Cabeçalho',
    SaasSubscriptionHeader,
    headerDefaultContent,
  ),
  HERO: entry('HERO', 'Destaque', SaasSubscriptionHero, heroDefaultContent),
  FEATURES: entry(
    'FEATURES',
    'Diferenciais',
    SaasSubscriptionFeatures,
    featuresDefaultContent,
  ),
  STEPS: entry(
    'STEPS',
    'Como funciona',
    SaasSubscriptionSteps,
    stepsGettingStartedDefaultContent,
  ),
  FACTS: entry('FACTS', 'Números', SaasSubscriptionFacts, factsDefaultContent),
  TESTIMONIAL: entry(
    'TESTIMONIAL',
    'Depoimento',
    SaasSubscriptionTestimonial,
    testimonialDefaultContent,
  ),
  PRICING: entry(
    'PRICING',
    'Preços',
    SaasSubscriptionPricing,
    pricingDefaultContent,
  ),
  FAQ: entry(
    'FAQ',
    'Perguntas frequentes',
    SaasSubscriptionFaq,
    faqDefaultContent,
  ),
  FOOTER: entry(
    'FOOTER',
    'Rodapé',
    SaasSubscriptionFooter,
    footerDefaultContent,
  ),
}
