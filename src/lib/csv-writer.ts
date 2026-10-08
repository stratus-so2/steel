/**
 * CSV writer for downloads (RFC 4180, CRLF, UTF-8 with BOM so Excel reads
 * the accents). Text cells starting with `=`, `+`, `-` or `@` get a leading
 * `'` so a spreadsheet never evaluates them as formulas (CSV injection);
 * numbers are written as-is, so negative values stay numeric.
 */

export const CSV_BOM = '﻿'

export type CsvValue = string | number | boolean | null | undefined

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function csvRow(cells: CsvValue[]): string {
  return `${cells.map(csvCell).join(',')}\r\n`
}

/** Whole document: BOM + header + rows. */
export function csvDocument(header: string[], rows: CsvValue[][]): string {
  return CSV_BOM + csvRow(header) + rows.map(csvRow).join('')
}
