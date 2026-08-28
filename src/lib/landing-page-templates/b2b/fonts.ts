import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "Brainwave.io" usa Rubik
 * Bold, que é a fonte real do design de referência (grátis no Google
 * Fonts) — mesmo kit visual do template Agency, mas com variável própria
 * pra não acoplar os dois templates.
 */
export const b2bLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-b2b-logo',
  weight: ['700'],
})
