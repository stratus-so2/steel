import { Prisma } from '@prisma/client'
import { type CsvValue, csvDocument } from '@/src/lib/csv-writer'
import type { ZipEntry } from '@/src/lib/zip'

/**
 * Builds the files of the "complete workspace data" export: one JSON and
 * one CSV per table, a manifest and a pt-BR read-me, ready to be zipped.
 * The rows come from `gatherWorkspaceData` (the same source of truth as
 * the per-workspace backup), so a new model with `workspaceId` shows up
 * here by itself. Unlike the backup, the file is handed to a person in
 * plain text — so credentials and tokens are replaced by a marker.
 */

export const DATA_EXPORT_SCHEMA_VERSION = 1
export const REDACTED = '[removido]'

/**
 * Column names that hold secrets or access tokens: encrypted credentials,
 * passwords, webhook secrets, OAuth/API tokens and their hashes. `inputTokens`
 * and friends (counts) do not match: only a name *ending* in `token` does.
 */
export const SECRET_FIELD =
  /^(encrypted.*|.*secret|.*password|.*token|.*tokenhash|keyhash|sessionhash)$/i

type Row = Record<string, unknown>

export interface DataArchiveInput {
  workspace: { id: string; name: string; slug: string }
  tables: Record<string, unknown[]>
  exportedAt: Date
  requestedBy: { name: string; email: string } | null
}

export interface DataArchive {
  entries: ZipEntry[]
  tables: { name: string; rows: number }[]
  totalRows: number
  redactedFields: string[]
}

/** JSON-safe copy of a value (BigInt → string; Date/Decimal via toJSON). */
function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

export function redactRow(row: Row, redacted: Set<string>): Row {
  const out: Row = {}
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_FIELD.test(key) && value !== null && value !== undefined) {
      redacted.add(key)
      out[key] = REDACTED
    } else {
      out[key] = value
    }
  }
  return out
}

function csvValue(value: unknown): CsvValue {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint' || Prisma.Decimal.isDecimal(value)) {
    return value.toString()
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  // JSON columns and arrays: their JSON text.
  return JSON.stringify(value, jsonReplacer)
}

/** CSV of heterogeneous rows: the header is the union of keys, in order. */
export function rowsToCsv(rows: Row[]): string {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  return csvDocument(
    columns,
    rows.map((row) => columns.map((column) => csvValue(row[column]))),
  )
}

function readMe(input: DataArchiveInput): string {
  const who = input.requestedBy
    ? `${input.requestedBy.name} <${input.requestedBy.email}>`
    : 'sistema'
  return [
    `Exportação completa do workspace "${input.workspace.name}" (${input.workspace.slug})`,
    `Gerada em ${input.exportedAt.toISOString()} (UTC) a pedido de ${who}.`,
    '',
    'Conteúdo',
    '- json/<tabela>.json: as linhas de cada tabela, como estão no banco.',
    '- csv/<tabela>.csv: as mesmas linhas em planilha (UTF-8; colunas JSON em texto).',
    '- manifest.json: lista das tabelas, quantidade de linhas e campos removidos.',
    '',
    'Credenciais, senhas, segredos e tokens de acesso foram substituídos por',
    `"${REDACTED}". Arquivos enviados (anexos, mídia) não fazem parte deste`,
    'pacote: as tabelas trazem as referências deles.',
    '',
    'Este arquivo contém dados pessoais. Guarde-o com segurança e apague-o',
    'quando não precisar mais dele (LGPD).',
    '',
  ].join('\r\n')
}

export function buildDataArchive(input: DataArchiveInput): DataArchive {
  const redacted = new Set<string>()
  const entries: ZipEntry[] = []
  const tables: { name: string; rows: number }[] = []

  for (const name of Object.keys(input.tables).sort()) {
    const raw = input.tables[name] ?? []
    const rows = raw.map((row) => redactRow(row as Row, redacted))
    tables.push({ name, rows: rows.length })
    if (rows.length === 0) continue
    entries.push({
      name: `json/${name}.json`,
      data: JSON.stringify(rows, jsonReplacer, 2),
    })
    entries.push({ name: `csv/${name}.csv`, data: rowsToCsv(rows) })
  }

  const totalRows = tables.reduce((sum, t) => sum + t.rows, 0)
  const redactedFields = [...redacted].sort()
  const manifest = {
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    workspace: input.workspace,
    totalRows,
    tables,
    redactedFields,
  }
  entries.unshift(
    { name: 'LEIA-ME.txt', data: readMe(input) },
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
  )
  return { entries, tables, totalRows, redactedFields }
}
