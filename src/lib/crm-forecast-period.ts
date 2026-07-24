import type { CrmQuotaPeriod } from '@prisma/client'

/**
 * Chaves de período derivadas de uma data, em UTC (o banco grava timestamps
 * em UTC). Mês = "AAAA-MM"; trimestre = "AAAA-Qn". Usadas para agrupar o
 * forecast e casar com as metas (CrmQuota.periodKey).
 */

export function monthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function quarterKey(date: Date): string {
  const year = date.getUTCFullYear()
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

/** Chave de período conforme a granularidade escolhida. */
export function periodKeyOf(date: Date, period: CrmQuotaPeriod): string {
  return period === 'QUARTER' ? quarterKey(date) : monthKey(date)
}
