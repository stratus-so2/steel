/**
 * Paleta fixa do template Job Site (fiel ao frame Figma "04-Job Site" — o
 * mesmo kit "Brainwave.io" do template Agency, reaproveitando os mesmos
 * tokens de marca). Só cobre os pontos onde a cor é consumida como valor JS
 * (arrays de variantes, `style` inline) — nas classes Tailwind
 * (`text-[#161c2d]` etc.) o hex fica literal de propósito, porque o scanner
 * do Tailwind precisa do texto estático da classe pra gerar o CSS; uma
 * variável interpolada ali não seria detectada.
 */
export const JOB_SITE_COLORS = {
  ink: '#161c2d',
  primary: '#473bf0',
  red: '#f64b4b',
  green: '#68d585',
  mist: '#f4f7fa',
} as const
