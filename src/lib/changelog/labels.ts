import type { ChangelogEntryTag } from '@/src/schemas/changelog-entry.schema'

export const CHANGELOG_TAG_LABELS: Record<ChangelogEntryTag, string> = {
  SERVICEDESK: 'ServiceDesk',
  CRM: 'CRM',
  COMUNICACAO: 'Comunicação',
  IA: 'Steel AI',
  PLATAFORMA: 'Plataforma',
}

const MONTH_LABELS = [
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

/** `2026-10-08T00:00:00.000Z` → `8 out 2026` (UTC: the date is a calendar day). */
export function formatChangelogDate(isoDate: string): string {
  const date = new Date(isoDate)
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}
