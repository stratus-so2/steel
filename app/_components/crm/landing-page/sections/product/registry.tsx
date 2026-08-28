import type { ComponentType } from 'react'
import type { SectionDefinition } from '../registry'
import { aboutDefaultContent, ProductAbout } from './about'
import { featuresDefaultContent, ProductFeatures } from './features'
import { footerDefaultContent, ProductFooter } from './footer'
import { headerDefaultContent, ProductHeader } from './header'
import { heroDefaultContent, ProductHero } from './hero'
import { ProductPricing, pricingDefaultContent } from './pricing'
import { ProductTestimonial, testimonialDefaultContent } from './testimonial'

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
 * Overrides pixel-perfect do template Product, por tipo de seção — fiel ao
 * frame Figma "09-Product". Pricing usa o tipo PRODUCTS (3 variantes de cor
 * do mesmo AirPods, não planos tiered — ver comentário em `pricing.tsx`).
 */
export const PRODUCT_SECTION_OVERRIDES: Partial<
  Record<SectionDefinition['type'], SectionDefinition>
> = {
  HEADER: entry('HEADER', 'Cabeçalho', ProductHeader, headerDefaultContent),
  HERO: entry('HERO', 'Destaque', ProductHero, heroDefaultContent),
  FEATURES: entry(
    'FEATURES',
    'Diferenciais',
    ProductFeatures,
    featuresDefaultContent,
  ),
  TESTIMONIAL: entry(
    'TESTIMONIAL',
    'Depoimento',
    ProductTestimonial,
    testimonialDefaultContent,
  ),
  ABOUT: entry('ABOUT', 'Sobre', ProductAbout, aboutDefaultContent),
  PRODUCTS: entry(
    'PRODUCTS',
    'Produtos',
    ProductPricing,
    pricingDefaultContent,
  ),
  FOOTER: entry('FOOTER', 'Rodapé', ProductFooter, footerDefaultContent),
}
