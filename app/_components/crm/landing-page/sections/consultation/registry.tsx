import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { ConsultationAbout, consultationAboutDefaultContent } from './about'
import { ConsultationFacts, consultationFactsDefaultContent } from './facts'
import { ConsultationFooter, consultationFooterDefaultContent } from './footer'
import { ConsultationHeader, consultationHeaderDefaultContent } from './header'
import { ConsultationHero, consultationHeroDefaultContent } from './hero'
import {
  ConsultationNewsletter,
  consultationNewsletterDefaultContent,
} from './newsletter'
import {
  ConsultationServices,
  consultationServicesDefaultContent,
} from './services'
import { ConsultationSteps, consultationStepsDefaultContent } from './steps'
import {
  ConsultationTestimonial,
  consultationTestimonialDefaultContent,
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
 * Overrides pixel-perfect do template Consultation, por tipo de seção,
 * fiel ao frame "08-Consultation":
 * - STEPS → bloco "Content" (vídeo editável + 3 passos numerados)
 * - NEWSLETTER → bloco "CTA" (tarja simples de inscrição)
 * - ABOUT → bloco "CTA Form" (painel escuro + card de formulário — o
 *   schema não tem campos de formulário dedicados, então os inputs de
 *   Nome/Email/Telefone/Serviço ficam decorativos/fixos no componente,
 *   sem submissão real; nenhum template tem backend de formulário).
 */
export const CONSULTATION_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry(
    'HEADER',
    'Cabeçalho',
    ConsultationHeader,
    consultationHeaderDefaultContent,
  ),
  HERO: entry(
    'HERO',
    'Destaque',
    ConsultationHero,
    consultationHeroDefaultContent,
  ),
  FACTS: entry(
    'FACTS',
    'Números',
    ConsultationFacts,
    consultationFactsDefaultContent,
  ),
  SERVICES: entry(
    'SERVICES',
    'Serviços',
    ConsultationServices,
    consultationServicesDefaultContent,
  ),
  STEPS: entry(
    'STEPS',
    'Como funciona',
    ConsultationSteps,
    consultationStepsDefaultContent,
  ),
  TESTIMONIAL: entry(
    'TESTIMONIAL',
    'Depoimento',
    ConsultationTestimonial,
    consultationTestimonialDefaultContent,
  ),
  ABOUT: entry(
    'ABOUT',
    'Chamada com formulário',
    ConsultationAbout,
    consultationAboutDefaultContent,
  ),
  NEWSLETTER: entry(
    'NEWSLETTER',
    'Newsletter',
    ConsultationNewsletter,
    consultationNewsletterDefaultContent,
  ),
  FOOTER: entry(
    'FOOTER',
    'Rodapé',
    ConsultationFooter,
    consultationFooterDefaultContent,
  ),
}
