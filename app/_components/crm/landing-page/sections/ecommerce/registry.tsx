import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { aboutDefaultContent, EcommerceAbout } from './about'
import { EcommerceFooter, footerDefaultContent } from './footer'
import { EcommerceHeader, headerDefaultContent } from './header'
import { EcommerceHero, heroDefaultContent } from './hero'
import { EcommerceProducts, productsDefaultContent } from './products'
import { EcommerceTestimonial, testimonialDefaultContent } from './testimonial'
import { EcommerceWorks, worksDefaultContent } from './works'

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
 * Overrides pixel-perfect do template ECommerce, por tipo de seção. WORKS
 * cobre a grade "Category" (foto + contagem de itens); PRODUCTS cobre a
 * grade "All Items" (foto + preço + preço original) — cada bloco do frame
 * usa o tipo que de fato modela seus dados.
 */
export const ECOMMERCE_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry('HEADER', 'Cabeçalho', EcommerceHeader, headerDefaultContent),
  HERO: entry('HERO', 'Destaque', EcommerceHero, heroDefaultContent),
  WORKS: entry('WORKS', 'Categorias', EcommerceWorks, worksDefaultContent),
  PRODUCTS: entry(
    'PRODUCTS',
    'Produtos',
    EcommerceProducts,
    productsDefaultContent,
  ),
  ABOUT: entry('ABOUT', 'Conteúdo', EcommerceAbout, aboutDefaultContent),
  TESTIMONIAL: entry(
    'TESTIMONIAL',
    'Depoimento',
    EcommerceTestimonial,
    testimonialDefaultContent,
  ),
  FOOTER: entry('FOOTER', 'Rodapé', EcommerceFooter, footerDefaultContent),
}
