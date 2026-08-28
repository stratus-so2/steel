import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { AgencyHeader, headerDefaultContent } from './header'
import { AgencyHero, heroDefaultContent } from './hero'
import { AgencyServices, servicesDefaultContent } from './services'

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
 * Overrides pixel-perfect do template Agency, por tipo de seção — só as
 * seções já portadas do Figma 1:1 entram aqui. As demais continuam usando o
 * componente genérico de `../registry` até serem portadas (ver tasks
 * #18-23), então a página nunca fica sem renderizar uma seção.
 */
export const AGENCY_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry('HEADER', 'Cabeçalho', AgencyHeader, headerDefaultContent),
  HERO: entry('HERO', 'Destaque', AgencyHero, heroDefaultContent),
  SERVICES: entry(
    'SERVICES',
    'Serviços',
    AgencyServices,
    servicesDefaultContent,
  ),
}
