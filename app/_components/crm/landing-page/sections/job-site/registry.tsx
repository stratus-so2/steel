import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { footerDefaultContent, JobSiteFooter } from './footer'
import { headerDefaultContent, JobSiteHeader } from './header'
import { heroDefaultContent, JobSiteHero } from './hero'
import { JobSiteLogos, logosDefaultContent } from './logos'
import { JobSiteNewsletter, newsletterDefaultContent } from './newsletter'
import { JobSiteServices, servicesDefaultContent } from './services'
import { JobSiteSteps, stepsDefaultContent } from './steps'
import { JobSiteWorks, worksDefaultContent } from './works'

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
 * Overrides pixel-perfect do template Job Site, por tipo de seção — só as
 * seções já portadas do Figma 1:1 entram aqui. `WORKS` aparece duas vezes no
 * frame ("Featured jobs" e "News that helps"), mas o registry só permite um
 * componente por tipo — `JobSiteWorks` resolve isso sozinho: cada card
 * escolhe seu próprio layout (listagem de vaga vs. card de notícia) olhando
 * se `category` bate com uma tag de emprego reconhecida (ver `works.tsx`).
 */
export const JOB_SITE_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry('HEADER', 'Cabeçalho', JobSiteHeader, headerDefaultContent),
  HERO: entry('HERO', 'Destaque', JobSiteHero, heroDefaultContent),
  LOGOS: entry('LOGOS', 'Empresas', JobSiteLogos, logosDefaultContent),
  SERVICES: entry(
    'SERVICES',
    'Categorias',
    JobSiteServices,
    servicesDefaultContent,
  ),
  STEPS: entry('STEPS', 'Como funciona', JobSiteSteps, stepsDefaultContent),
  WORKS: entry('WORKS', 'Vagas e notícias', JobSiteWorks, worksDefaultContent),
  NEWSLETTER: entry(
    'NEWSLETTER',
    'Newsletter',
    JobSiteNewsletter,
    newsletterDefaultContent,
  ),
  FOOTER: entry('FOOTER', 'Rodapé', JobSiteFooter, footerDefaultContent),
}
