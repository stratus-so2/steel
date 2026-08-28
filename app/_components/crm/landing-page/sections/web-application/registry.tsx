import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { aboutDefaultContent, WebApplicationAbout } from './about'
import { featuresDefaultContent, WebApplicationFeatures } from './features'
import { footerDefaultContent, WebApplicationFooter } from './footer'
import { headerDefaultContent, WebApplicationHeader } from './header'
import { heroDefaultContent, WebApplicationHero } from './hero'
import { logosDefaultContent, WebApplicationLogos } from './logos'
import { pricingDefaultContent, WebApplicationPricing } from './pricing'
import { stepsDefaultContent, WebApplicationSteps } from './steps'
import {
  testimonialDefaultContent,
  WebApplicationTestimonial,
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
 * Overrides pixel-perfect do template Web Application, por tipo de seção.
 * ABOUT é usado 2x no `sections` do template (Content 01 e Content 03, ver
 * `src/lib/landing-page-templates/web-application.ts`) — ambos renderizam
 * com este mesmo componente, só o `content` muda.
 */
export const WEB_APPLICATION_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry(
    'HEADER',
    'Cabeçalho',
    WebApplicationHeader,
    headerDefaultContent,
  ),
  HERO: entry('HERO', 'Destaque', WebApplicationHero, heroDefaultContent),
  LOGOS: entry('LOGOS', 'Logos', WebApplicationLogos, logosDefaultContent),
  FEATURES: entry(
    'FEATURES',
    'Diferenciais',
    WebApplicationFeatures,
    featuresDefaultContent,
  ),
  ABOUT: entry('ABOUT', 'Sobre', WebApplicationAbout, aboutDefaultContent),
  STEPS: entry('STEPS', 'Conteúdo', WebApplicationSteps, stepsDefaultContent),
  PRICING: entry(
    'PRICING',
    'Preços',
    WebApplicationPricing,
    pricingDefaultContent,
  ),
  TESTIMONIAL: entry(
    'TESTIMONIAL',
    'Depoimento',
    WebApplicationTestimonial,
    testimonialDefaultContent,
  ),
  FOOTER: entry('FOOTER', 'Rodapé', WebApplicationFooter, footerDefaultContent),
}
