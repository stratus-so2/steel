/** Chave de quinzena: dia 1–15 → "…-01", dia 16–fim → "…-16". */
export function getFortnightKey(date: string): string {
  const d = new Date(date)
  const half = d.getDate() <= 15 ? '01' : '16'
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${half}`
}

/** Chave mensal: YYYY-MM. */
export function getMonthKey(date: string): string {
  return date.slice(0, 7)
}

const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

/**
 * Formata label do eixo X:
 * - YYYY-MM-DD → dd/mm  (ex.: 15/01)
 * - YYYY-MM    → mmm/aa (ex.: jan/24)
 */
export function formatAxisLabel(v: string | number | Date): string {
  const s = String(v)
  const parts = s.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  if (parts.length === 2) {
    const idx = Number.parseInt(parts[1], 10) - 1
    return `${MONTHS_PT[idx] ?? parts[1]}/${parts[0].slice(2)}`
  }
  return s
}

/**
 * Converte série diária para o formato `{ x, y }` do nivo.
 * Quando `groupKey` é fornecido agrega (soma) os pontos do mesmo grupo;
 * sem `groupKey` mapeia cada ponto diretamente.
 */
export function toNivoSeries<T extends { date: string }>(
  series: T[],
  getValue: (point: T) => number,
  groupKey: ((date: string) => string) | null,
): { x: string; y: number }[] {
  if (!groupKey) {
    return series.map((p) => ({ x: p.date, y: getValue(p) }))
  }
  const groups = new Map<string, number>()
  for (const p of series) {
    const key = groupKey(p.date)
    groups.set(key, (groups.get(key) ?? 0) + getValue(p))
  }
  return [...groups.entries()].map(([x, y]) => ({ x, y }))
}

export const CHART_THEME = {
  text: { fill: 'currentColor', fontSize: 11 },
  axis: {
    ticks: {
      text: { fill: 'currentColor' },
      line: { stroke: 'transparent' },
    },
    domain: { line: { stroke: 'currentColor', strokeOpacity: 0.15 } },
  },
  grid: { line: { stroke: 'currentColor', strokeOpacity: 0.08 } },
  tooltip: {
    container: {
      background: 'var(--color-popover)',
      color: 'var(--color-popover-foreground)',
      fontSize: 12,
    },
  },
} as const
