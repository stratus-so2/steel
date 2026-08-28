import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "Brainwave.io" usa Rubik
 * Bold, que é a fonte real do design de referência (grátis no Google Fonts).
 */
export const agencyLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-agency-logo',
  weight: ['700'],
})
