/**
 * Paleta fixa do template Mobile App (fiel ao frame Figma de referência).
 * Só cobre os pontos onde a cor é consumida como valor JS (gradientes
 * inline, arrays de variantes de ícone) — nas classes Tailwind
 * (`text-[#161c2d]` etc.) o hex fica literal de propósito, porque o
 * scanner do Tailwind precisa do texto estático da classe pra gerar o CSS;
 * uma variável interpolada ali não seria detectada.
 */
export const MOBILE_APP_COLORS = {
  ink: '#161c2d',
  red: '#f74d4d',
  green: '#68d585',
  primary: '#473bf0',
  mist: '#f4f7fa',
  purpleStart: '#7b11f9',
  purpleMid: '#7922d8',
  purpleEnd: '#3636b2',
  navyStart: '#313c59',
  navyEnd: '#161c2d',
} as const

/** Gradiente de fundo do Header/Hero (roxo), fiel ao node 0:969 do Figma. */
export const MOBILE_APP_HERO_GRADIENT = `linear-gradient(210.93deg, ${MOBILE_APP_COLORS.purpleStart} 0.3%, ${MOBILE_APP_COLORS.purpleMid} 39.59%, ${MOBILE_APP_COLORS.purpleEnd} 100%)`

/** Gradiente de fundo da faixa escura (Features/Testimonial), node 0:562. */
export const MOBILE_APP_NAVY_GRADIENT = `linear-gradient(233.72deg, ${MOBILE_APP_COLORS.navyStart} 0%, ${MOBILE_APP_COLORS.navyEnd} 100%)`
