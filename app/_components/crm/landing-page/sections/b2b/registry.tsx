import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { aboutDefaultContent, B2bAbout } from './about'
import { B2bFeatures, featuresDefaultContent } from './features'
import { B2bFooter, footerDefaultContent } from './footer'
import { B2bHeader, headerDefaultContent } from './header'
import { B2bHero, heroDefaultContent } from './hero'
import { B2bServices, servicesDefaultContent } from './services'
import { B2bTestimonial, testimonialDefaultContent } from './testimonial'

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
 * Overrides pixel-perfect do template B2B, por tipo de seção — fiel ao
 * frame "10-B2B" do kit Figma de referência (node 0:2). O frame não tem
 * tipos correspondentes pra "Alert" (banner fino) e "Video" (banner com
 * botão de play) no vocabulário compartilhado de 15 tipos — ver os
 * comentários em `hero.tsx` e `services.tsx` pra como cada um foi dobrado
 * dentro de uma seção vizinha.
 */
export const B2B_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry('HEADER', 'Cabeçalho', B2bHeader, headerDefaultContent),
  HERO: entry('HERO', 'Destaque', B2bHero, heroDefaultContent),
  ABOUT: entry('ABOUT', 'Sobre', B2bAbout, aboutDefaultContent),
  SERVICES: entry('SERVICES', 'Serviços', B2bServices, servicesDefaultContent),
  FEATURES: entry(
    'FEATURES',
    'Diferenciais',
    B2bFeatures,
    featuresDefaultContent,
  ),
  TESTIMONIAL: entry(
    'TESTIMONIAL',
    'Depoimento',
    B2bTestimonial,
    testimonialDefaultContent,
  ),
  FOOTER: entry('FOOTER', 'Rodapé', B2bFooter, footerDefaultContent),
}
