import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "shadepro" usa Rubik Bold,
 * que é a fonte real do design de referência (grátis no Google Fonts) —
 * mesma escolha do wordmark do template Agency.
 */
export const consultationLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-consultation-logo',
  weight: ['700'],
})
