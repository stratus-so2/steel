import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { aboutDefaultContent, CoworkingAbout } from './about'
import { CoworkingFacts, factsDefaultContent } from './facts'
import { CoworkingFaq, faqDefaultContent } from './faq'
import { CoworkingFeatures, featuresDefaultContent } from './features'
import { CoworkingFooter, footerDefaultContent } from './footer'
import { CoworkingHero, heroDefaultContent } from './hero'
import { CoworkingLocations, worksDefaultContent } from './locations'
import { CoworkingNewsletter, newsletterDefaultContent } from './newsletter'
import { CoworkingSteps, stepsDefaultContent } from './steps'

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
 * Overrides pixel-perfect do template Coworking, por tipo de seção — fiel
 * ao frame "03-Coworking" do Figma (node 0:2226). O frame divide "Content
 * 02" em duas seções independentes aqui (STEPS + FAQ) — ver comentário em
 * `steps.tsx`/`faq.tsx`.
 */
export const COWORKING_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HERO: entry('HERO', 'Destaque', CoworkingHero, heroDefaultContent),
  FACTS: entry('FACTS', 'Números', CoworkingFacts, factsDefaultContent),
  WORKS: entry('WORKS', 'Locais', CoworkingLocations, worksDefaultContent),
  ABOUT: entry('ABOUT', 'Sobre', CoworkingAbout, aboutDefaultContent),
  FEATURES: entry(
    'FEATURES',
    'Diferenciais',
    CoworkingFeatures,
    featuresDefaultContent,
  ),
  STEPS: entry('STEPS', 'Benefícios', CoworkingSteps, stepsDefaultContent),
  FAQ: entry('FAQ', 'Perguntas frequentes', CoworkingFaq, faqDefaultContent),
  NEWSLETTER: entry(
    'NEWSLETTER',
    'Newsletter',
    CoworkingNewsletter,
    newsletterDefaultContent,
  ),
  FOOTER: entry('FOOTER', 'Rodapé', CoworkingFooter, footerDefaultContent),
}
