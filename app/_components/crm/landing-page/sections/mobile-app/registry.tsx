import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { featuresDefaultContent, MobileAppFeatures } from './features'
import { footerDefaultContent, MobileAppFooter } from './footer'
import { headerDefaultContent, MobileAppHeader } from './header'
import { heroDefaultContent, MobileAppHero } from './hero'
import { MobileAppPricing, pricingDefaultContent } from './pricing'
import { MobileAppSteps, stepsDefaultContent } from './steps'
import { MobileAppTestimonial, testimonialDefaultContent } from './testimonial'

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
 * Overrides pixel-perfect do template Mobile App, por tipo de seção — só
 * as seções já portadas do Figma 1:1 entram aqui. STEPS cobre três blocos
 * diferentes do frame (Content 01/02, How e Video); TESTIMONIAL cobre os 3
 * cards empilhados — ver `sections/mobile-app/steps.tsx` e
 * `sections/mobile-app/testimonial.tsx` pros detalhes de layout.
 */
export const MOBILE_APP_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry('HEADER', 'Cabeçalho', MobileAppHeader, headerDefaultContent),
  HERO: entry('HERO', 'Destaque', MobileAppHero, heroDefaultContent),
  STEPS: entry('STEPS', 'Como funciona', MobileAppSteps, stepsDefaultContent),
  TESTIMONIAL: entry(
    'TESTIMONIAL',
    'Depoimento',
    MobileAppTestimonial,
    testimonialDefaultContent,
  ),
  FEATURES: entry(
    'FEATURES',
    'Diferenciais',
    MobileAppFeatures,
    featuresDefaultContent,
  ),
  PRICING: entry('PRICING', 'Preços', MobileAppPricing, pricingDefaultContent),
  FOOTER: entry('FOOTER', 'Rodapé', MobileAppFooter, footerDefaultContent),
}
