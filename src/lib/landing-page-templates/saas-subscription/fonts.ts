import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "Brainwave.io" usa Rubik
 * Bold, que é a fonte real do design de referência (grátis no Google Fonts).
 * Escopo próprio (em vez de reaproveitar `agencyLogoFont`) pra manter os
 * templates independentes entre si.
 */
export const saasSubscriptionLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-saas-subscription-logo',
  weight: ['700'],
})
