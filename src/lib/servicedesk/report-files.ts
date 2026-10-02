import { SD_TICKET_BUCKET } from './ticket-files'

/**
 * Arquivos dos relatórios no MinIO: mesmo bucket privado do módulo
 * (`servicedesk`), prefixo `<workspaceId>/reports/`. Servidos sempre por
 * rota autenticada que confere o acesso — o bucket não é público.
 */
export const SD_REPORT_BUCKET = SD_TICKET_BUCKET

export type SdReportFileFormat = 'PDF' | 'CSV'

const EXTENSION: Record<SdReportFileFormat, string> = {
  PDF: 'pdf',
  CSV: 'csv',
}

export const SD_REPORT_CONTENT_TYPE: Record<SdReportFileFormat, string> = {
  PDF: 'application/pdf',
  CSV: 'text/csv; charset=utf-8',
}

export function sdReportFileKey(
  workspaceId: string,
  runId: string,
  format: SdReportFileFormat,
): string {
  return `${workspaceId}/reports/${runId}.${EXTENSION[format]}`
}

/** `relatorio-sla-2026-09.pdf` — nome amigável do download e do anexo. */
export function sdReportFileName(
  reportName: string,
  periodStart: Date | string,
  format: SdReportFileFormat,
): string {
  const start =
    typeof periodStart === 'string' ? new Date(periodStart) : periodStart
  const slug =
    reportName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'relatorio'
  return `${slug}-${start.toISOString().slice(0, 10)}.${EXTENSION[format]}`
}
