import z from 'zod'

/**
 * Fontes de dados dos dashboards do ServiceDesk. Cada uma devolve linhas
 * achatadas (rótulos em pt-BR + campos derivados de SLA/MTTR/CSAT) que o
 * motor de widgets do CRM agrega no navegador. Ver `types/sd-dashboard.d.ts`.
 */
export const SD_DASHBOARD_SOURCES = [
  'sd-tickets',
  'sd-ticket-costs',
  'sd-ticket-events',
  'sd-kb-articles',
] as const

export type SdDashboardSource = (typeof SD_DASHBOARD_SOURCES)[number]

export const SdDashboardSourceSchema = z.enum(SD_DASHBOARD_SOURCES, {
  error: 'Fonte de dados desconhecida',
})

/** Parâmetros de `GET .../servicedesk/dashboards/sources/[source]`. */
export const SdDashboardSourceParamsSchema = z.object({
  source: SdDashboardSourceSchema,
})

/**
 * Janela de histórico das fontes (chamados abertos entram sempre). 400 dias
 * cobrem "ano atual" e a comparação de 30 dias com folga.
 */
export const SD_DASHBOARD_HISTORY_DAYS = 400

/** Teto de linhas por fonte (os widgets agregam no navegador). */
export const SD_DASHBOARD_ROW_LIMITS: Record<SdDashboardSource, number> = {
  'sd-tickets': 10_000,
  'sd-ticket-costs': 10_000,
  'sd-ticket-events': 20_000,
  'sd-kb-articles': 2_000,
}
