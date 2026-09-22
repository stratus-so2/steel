/**
 * CSV simples para importação de cadastros do ServiceDesk (lib pura, roda
 * no navegador e no servidor). Aceita `,` ou `;` (padrão do Excel em pt-BR,
 * detectado pela primeira linha), aspas com `""` escapado, quebras de linha
 * dentro de aspas, CRLF e BOM.
 */

export type SdCsvDelimiter = ',' | ';'

export function detectCsvDelimiter(text: string): SdCsvDelimiter {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? ''
  const semicolons = (firstLine.match(/;/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

/** Linhas → células. Linhas totalmente vazias são descartadas. */
export function parseCsv(
  text: string,
  delimiter: SdCsvDelimiter = detectCsvDelimiter(text),
): string[][] {
  const input = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell)
  rows.push(row)

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** "Razão Social" → "razao_social". */
export function normalizeCsvHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export interface SdCsvRecords {
  headers: string[]
  /** Cada linha como `{ cabeçalho_normalizado: valor }` (com trim). */
  records: Record<string, string>[]
}

/** Primeira linha = cabeçalho. */
export function csvToRecords(text: string): SdCsvRecords {
  const [head, ...body] = parseCsv(text)
  if (!head) return { headers: [], records: [] }
  const headers = head.map(normalizeCsvHeader)
  const records = body.map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (header) record[header] = (cells[index] ?? '').trim()
    })
    return record
  })
  return { headers, records }
}

/** Primeiro valor não vazio entre os aliases de coluna. */
export function pickCsvValue(
  record: Record<string, string>,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const value = record[alias]
    if (value) return value
  }
  return undefined
}
