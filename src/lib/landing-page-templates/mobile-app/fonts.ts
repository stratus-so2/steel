import { Rubik } from 'next/font/google'

/**
 * O corpo/títulos usam o Geist já carregado globalmente (app/layout.tsx) —
 * sem custo extra de carregamento. Só o wordmark "Brainwave.io" usa Rubik
 * Bold, a fonte real do design de referência (grátis no Google Fonts) —
 * mesma família do template Agency, mas carregada isoladamente aqui pra
 * não acoplar os dois templates.
 */
export const mobileAppLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-mobile-app-logo',
  weight: ['700'],
})
