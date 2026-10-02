/**
 * Tons de status do ServiceDesk — a única fonte de verdade de cor do módulo.
 *
 * Fica na raiz do módulo, e não na pasta do chamado, porque quadro, chamado,
 * diretório, contratos, conhecimento, risco e portal usam os mesmos tons: cada
 * área manter a sua cópia é exatamente como o módulo divergia de si mesmo.
 *
 * Tudo que não é status usa token semântico (`muted`, `card`, `primary`,
 * `destructive`, `border`…) — cor crua da paleta não acompanha o tema e
 * estraga o modo claro. Mapa fechado também é requisito técnico: o Tailwind só
 * enxerga as classes escritas aqui, então nenhuma tela deve montar
 * `bg-<cor>-500/10` por conta própria.
 */

/** Os tons que o módulo tem. Não há outros. */
export type SdTone =
  | 'slate'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'orange'
  | 'red'
  | 'rose'

/** Fundo translúcido + texto legível nos dois temas — o padrão do repo. */
export const SD_TONE: Record<SdTone, string> = {
  slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

/** O mesmo tom com borda — chips, faixas de aviso e cartões de estado. */
export const SD_TONE_SOFT: Record<SdTone, string> = {
  slate:
    'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  sky: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  indigo:
    'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  violet:
    'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  teal: 'border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  emerald:
    'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber:
    'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange:
    'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  red: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  rose: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

/** Só a cor do texto ou do ícone, sobre superfície lisa. */
export const SD_TONE_TEXT: Record<SdTone, string> = {
  slate: 'text-slate-700 dark:text-slate-300',
  sky: 'text-sky-700 dark:text-sky-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
  violet: 'text-violet-700 dark:text-violet-300',
  teal: 'text-teal-700 dark:text-teal-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  orange: 'text-orange-700 dark:text-orange-300',
  red: 'text-red-700 dark:text-red-300',
  rose: 'text-rose-700 dark:text-rose-300',
}

/** Preenchimento sólido — barras de progresso e pontos de legenda. */
export const SD_TONE_FILL: Record<SdTone, string> = {
  slate: 'bg-slate-500',
  sky: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  rose: 'bg-rose-500',
}
