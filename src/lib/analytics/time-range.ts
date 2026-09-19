import type { AnalyticsRange } from '@/src/schemas/admin-analytics.schema'

/** Janela e largura do balde das séries por intervalo do filtro. */
export const RANGE_CONFIG: Record<
  AnalyticsRange,
  { seconds: number; bin: string; binSeconds: number }
> = {
  '15m': { seconds: 15 * 60, bin: '30s', binSeconds: 30 },
  '1h': { seconds: 60 * 60, bin: '1m', binSeconds: 60 },
  '24h': { seconds: 24 * 3600, bin: '15m', binSeconds: 15 * 60 },
  '7d': { seconds: 7 * 86400, bin: '1h', binSeconds: 3600 },
  '30d': { seconds: 30 * 86400, bin: '6h', binSeconds: 6 * 3600 },
}

export interface TimeWindow {
  range: AnalyticsRange
  from: Date
  to: Date
  bin: string
  binSeconds: number
}

export function resolveWindow(range: AnalyticsRange, now: Date): TimeWindow {
  const config = RANGE_CONFIG[range]
  return {
    range,
    from: new Date(now.getTime() - config.seconds * 1000),
    to: now,
    bin: config.bin,
    binSeconds: config.binSeconds,
  }
}

/** Início de cada balde da janela (alinhado ao múltiplo do balde, UTC). */
export function bucketStarts(window: TimeWindow): Date[] {
  const step = window.binSeconds * 1000
  const first = Math.floor(window.from.getTime() / step) * step
  const out: Date[] = []
  for (let t = first; t <= window.to.getTime(); t += step) out.push(new Date(t))
  return out
}
