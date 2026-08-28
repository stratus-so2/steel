import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "Brainwave.io" usa Rubik
 * Bold, que é a fonte real do design de referência (grátis no Google
 * Fonts) — mesma fonte do template Agency, mas instanciada à parte pra não
 * acoplar este template ao módulo de outro.
 */
export const jobSiteLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-job-site-logo',
  weight: ['700'],
})
