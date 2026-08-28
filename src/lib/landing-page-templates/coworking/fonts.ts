import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "Brainwave.io" usa Rubik
 * Bold, que é a fonte real do design de referência (grátis no Google
 * Fonts) — mesmo kit visual do template Agency, módulo próprio pra manter
 * os templates desacoplados.
 */
export const coworkingLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-coworking-logo',
  weight: ['700'],
})
