/**
 * Paleta fixa do template Web Application (fiel ao frame Figma de
 * referência, node 0:1371 — mesmo kit "Brainwave.io" do template Agency,
 * variante SaaS). Só cobre os pontos onde a cor é consumida como valor JS
 * (arrays de variantes, `style` inline) — nas classes Tailwind
 * (`text-[#161c2d]` etc.) o hex fica literal de propósito, porque o scanner
 * do Tailwind precisa do texto estático da classe pra gerar o CSS.
 */
export const WEB_APPLICATION_COLORS = {
  ink: '#161c2d',
  primary: '#473bf0',
  green: '#68d585',
  mist: '#ecf2f7',
  border: '#e7e9ed',
} as const
