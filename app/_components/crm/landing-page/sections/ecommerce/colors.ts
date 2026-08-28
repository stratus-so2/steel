/**
 * Paleta fixa do template ECommerce (fiel ao frame Figma "06-ECommerce").
 * Só cobre os pontos onde a cor é consumida como valor JS — nas classes
 * Tailwind (`text-[#161c2d]` etc.) o hex fica literal de propósito, porque o
 * scanner do Tailwind precisa do texto estático da classe pra gerar o CSS;
 * uma variável interpolada ali não seria detectada.
 */
export const ECOMMERCE_COLORS = {
  ink: '#161c2d',
  primary: '#473bf0',
  green: '#68d585',
  mist: '#f4f7fa',
  night: '#0a0d17',
} as const
