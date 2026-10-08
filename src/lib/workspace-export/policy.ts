import {
  addDayKey,
  localDayKey,
  localDayStart,
} from '@/src/lib/productivity/period'

/**
 * The "once a day" of the workspace exports is a civil day in São Paulo
 * (the platform's time zone, same as the worker's crons): a new export of
 * each kind is allowed again at the next local midnight.
 */

export const EXPORT_TIMEZONE = 'America/Sao_Paulo'

/** MinIO bucket of the export files (`<workspaceId>/<exportId>.zip`). */
export const EXPORT_BUCKET = 'workspace-exports'

export const EXPORT_KIND_LABELS = {
  DATA: 'dados completos',
  LOGS: 'logs',
} as const satisfies Record<'DATA' | 'LOGS', string>

/** Days an export file stays downloadable. */
export const EXPORT_RETENTION_DAYS = 7

export function exportDayKey(at: Date): string {
  return localDayKey(at, EXPORT_TIMEZONE)
}

/** Next local midnight after `at`: when the daily slot opens again. */
export function nextExportSlot(at: Date): Date {
  return localDayStart(addDayKey(exportDayKey(at), 1), EXPORT_TIMEZONE)
}

export function exportExpiry(completedAt: Date): Date {
  return new Date(
    completedAt.getTime() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  )
}

const SLOT_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: EXPORT_TIMEZONE,
})

/** `09/10/2026, 00:00` — in São Paulo time, whatever the server's zone. */
export function formatExportInstant(at: Date): string {
  return SLOT_FORMATTER.format(at)
}
