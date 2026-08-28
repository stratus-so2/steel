/**
 * Paleta fixa do template Coworking (fiel ao frame Figma "03-Coworking" —
 * mesmo kit "Brainwave.io" do Agency, cores idênticas). Só cobre os pontos
 * onde a cor é consumida como valor JS (arrays de variantes, `style`
 * inline) — nas classes Tailwind (`text-[#161c2d]` etc.) o hex fica literal
 * de propósito, porque o scanner do Tailwind precisa do texto estático da
 * classe pra gerar o CSS; uma variável interpolada ali não seria detectada.
 */
export const COWORKING_COLORS = {
  ink: '#161c2d',
  primary: '#473bf0',
  green: '#68d585',
  mist: '#f4f7fa',
} as const
