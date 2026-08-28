import { Plus_Jakarta_Sans, Rubik } from 'next/font/google'

/**
 * O design de referência (Figma) usa Gilroy — fonte comercial sem
 * distribuição gratuita, então não pode ser bundlada aqui. Plus Jakarta
 * Sans é a substituta mais próxima disponível no Google Fonts (geométrica,
 * x-height alto, terminais arredondados — mesmo "feel" do Gilroy). Rubik
 * (usada só no wordmark "Brainwave.io") é a fonte real do design.
 */
export const agencyBodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-agency-body',
  weight: ['400', '500', '600', '700', '800'],
})

export const agencyLogoFont = Rubik({
  subsets: ['latin'],
  variable: '--font-agency-logo',
  weight: ['700'],
})

export const AGENCY_FONT_CLASS = `${agencyBodyFont.variable} ${agencyLogoFont.variable} font-[family-name:var(--font-agency-body)]`
