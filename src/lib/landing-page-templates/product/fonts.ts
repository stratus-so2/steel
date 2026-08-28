import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "Brainwave.io" usa Rubik
 * Bold, que é a fonte real do design de referência (grátis no Google Fonts)
 * — mesmo kit visual do template Agency, mas mantido isolado por template
 * (`src/lib/landing-page-templates/product/fonts.ts`) pra não acoplar
 * templates entre si.
 */
export const productLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-product-logo',
  weight: ['700'],
})
