import type {
  SdReportRunWithRelations,
  SdScheduledReportWithCount,
} from '@/src/repositories/sd-report.repository'
import type {
  SdReportFormatDTO,
  SdReportRunDTO,
  SdReportSummaryDTO,
  SdScheduledReportDTO,
} from '@/types/sd-report'

/**
 * `SdScheduledReport`/`SdReportRun` → DTO. Os rótulos do recorte (nome do
 * cliente e do departamento) entram por um `lookup` que o service monta numa
 * consulta só — o mapper continua síncrono e puro.
 *
 * `formats` da execução é derivado das chaves gravadas no MinIO: é o que
 * realmente existe para baixar, não o que o agendamento pediu.
 */

export interface SdReportLabelLookup {
  customers: Map<string, string>
  departments: Map<string, string>
}

export const EMPTY_SD_REPORT_LOOKUP: SdReportLabelLookup = {
  customers: new Map(),
  departments: new Map(),
}

function named(
  ids: string[],
  labels: Map<string, string>,
): { id: string; name: string }[] {
  return ids.flatMap((id) => {
    const name = labels.get(id)
    return name ? [{ id, name }] : []
  })
}

export function toSdScheduledReportDTO(
  row: SdScheduledReportWithCount,
  lookup: SdReportLabelLookup = EMPTY_SD_REPORT_LOOKUP,
): SdScheduledReportDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    kind: row.kind,
    customerIds: row.customerIds,
    customers: named(row.customerIds, lookup.customers),
    departmentIds: row.departmentIds,
    departments: named(row.departmentIds, lookup.departments),
    ticketTypes: row.ticketTypes,
    period: row.period,
    formats: row.formats,
    dayOfMonth: row.dayOfMonth,
    atTime: row.atTime,
    timezone: row.timezone,
    recipients: row.recipients,
    includeAccountOwners: row.includeAccountOwners,
    active: row.active,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    runCount: row._count.runs,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Resumo gravado em `Json`: só objeto passa (linha antiga ou corrompida → `null`). */
function toSummary(summary: unknown): SdReportSummaryDTO | null {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return null
  }
  return summary as SdReportSummaryDTO
}

export function toSdReportRunDTO(
  row: SdReportRunWithRelations,
): SdReportRunDTO {
  const formats: SdReportFormatDTO[] = []
  if (row.pdfKey) formats.push('PDF')
  if (row.csvKey) formats.push('CSV')

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    reportId: row.reportId,
    reportName: row.report?.name ?? null,
    kind: row.kind,
    status: row.status,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    summary: toSummary(row.summary),
    formats,
    recipients: row.recipients,
    sentAt: row.sentAt?.toISOString() ?? null,
    error: row.error,
    requestedById: row.requestedById,
    requestedBy: row.requestedBy ? { ...row.requestedBy } : null,
    createdAt: row.createdAt.toISOString(),
  }
}
