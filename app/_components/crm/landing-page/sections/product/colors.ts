/**
 * Paleta fixa do template Product (fiel ao frame Figma "09-Product" —
 * mesmo kit visual do Agency, cores idênticas). Só cobre os pontos onde a
 * cor é consumida como valor JS (arrays de variantes) — nas classes
 * Tailwind (`text-[#161c2d]` etc.) o hex fica literal de propósito, porque
 * o scanner do Tailwind precisa do texto estático da classe pra gerar o
 * CSS; uma variável interpolada ali não seria detectada.
 */
export const PRODUCT_COLORS = {
  ink: '#161c2d',
  primary: '#473bf0',
  red: '#f64b4b',
  cream: '#fde7c3',
  mist: '#f4f7fa',
} as const
