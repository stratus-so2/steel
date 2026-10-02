import type { SdSlaReportSummary } from '@/src/lib/servicedesk/report-sla'
import type { SdTicketTypeDTO } from './sd-ticket'

/** Hoje só existe o relatório de SLA; o enum deixa espaço para os próximos. */
export type SdReportKindDTO = 'SLA'

export type SdReportFormatDTO = 'PDF' | 'CSV'

export type SdReportPeriodDTO =
  | 'LAST_MONTH'
  | 'LAST_WEEK'
  | 'CURRENT_MONTH'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'

export type SdReportRunStatusDTO = 'GENERATED' | 'SENT' | 'FAILED'

/** Resumo apurado de uma execução (`src/lib/servicedesk/report-sla.ts`). */
export type SdReportSummaryDTO = SdSlaReportSummary

/**
 * Relatório agendado: o recorte, o período, os formatos, a agenda (dia, hora
 * e **fuso do relatório**) e os destinatários. `nextRunAt` é quando o worker
 * vai gerar e enviar; `null` quando está pausado.
 */
export interface SdScheduledReportDTO {
  id: string
  workspaceId: string
  name: string
  kind: SdReportKindDTO
  /** Recorte: vazio = todos. */
  customerIds: string[]
  customers: { id: string; name: string }[]
  departmentIds: string[]
  departments: { id: string; name: string }[]
  ticketTypes: SdTicketTypeDTO[]
  period: SdReportPeriodDTO
  formats: SdReportFormatDTO[]
  dayOfMonth: number
  atTime: string
  timezone: string
  recipients: string[]
  includeAccountOwners: boolean
  active: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  /** Execuções já registradas. */
  runCount: number
  createdById: string
  createdAt: string
  updatedAt: string
}

/** Uma execução: o período apurado, o resumo, os arquivos e o envio. */
export interface SdReportRunDTO {
  id: string
  workspaceId: string
  reportId: string | null
  /** Nome do agendamento, ou `null` num relatório sob demanda. */
  reportName: string | null
  kind: SdReportKindDTO
  status: SdReportRunStatusDTO
  periodStart: string
  periodEnd: string
  summary: SdReportSummaryDTO | null
  /** Formatos disponíveis para download (o que foi realmente gravado). */
  formats: SdReportFormatDTO[]
  recipients: string[]
  sentAt: string | null
  error: string | null
  requestedById: string | null
  requestedBy: { id: string; name: string } | null
  createdAt: string
}
