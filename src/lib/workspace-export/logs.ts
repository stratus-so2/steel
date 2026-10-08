import { NEXT_PUBLIC_AXIOM_DATASET } from '@/lib/env/env'
import { AXIOM_QUERY_TOKEN, AXIOM_QUERY_URL } from '@/lib/env/server'
import { aplString, datasetRef } from '@/src/lib/analytics/apl'
import type { AplRow } from '@/src/lib/analytics/axiom-query'
import { DEFAULT_AXIOM_QUERY_URL } from '@/src/lib/analytics/config'
import { csvDocument } from '@/src/lib/csv-writer'

/**
 * "Workspace logs" export: the request logs (`request.workspaceId`, written
 * by `withAxiom`) and the application/audit events that carry the
 * workspace (`fields.workspaceId`) in Axiom. Needs `AXIOM_QUERY_TOKEN` (a
 * token with *Query* permission) — without it the option is off.
 */

export const LOGS_PERIOD_DAYS = [1, 7, 30] as const
export type LogsPeriodDays = (typeof LOGS_PERIOD_DAYS)[number]

/** Hard cap of rows per export (one APL query). */
export const LOGS_MAX_ROWS = 50_000

export interface WorkspaceLogsConfig {
  configured: boolean
  token?: string
  url: string
  dataset: string
}

export function resolveWorkspaceLogsConfig(
  env: { token?: string; url?: string; dataset?: string } = {
    token: AXIOM_QUERY_TOKEN,
    url: AXIOM_QUERY_URL,
    dataset: NEXT_PUBLIC_AXIOM_DATASET,
  },
): WorkspaceLogsConfig {
  const url = env.url || DEFAULT_AXIOM_QUERY_URL
  if (!env.token || !env.dataset) {
    return { configured: false, url, dataset: env.dataset ?? '' }
  }
  return { configured: true, token: env.token, url, dataset: env.dataset }
}

/** Output columns, in order (CSV header and NDJSON keys). */
export const LOG_COLUMNS = [
  'time',
  'level',
  'source',
  'message',
  'method',
  'path',
  'status',
  'userId',
  'category',
  'entity',
  'action',
  'actorId',
  'targetId',
  'outcome',
  'detail',
] as const

const opt = (field: string) => `tostring(column_ifexists('${field}', ''))`

export function workspaceLogsApl(
  dataset: string,
  workspaceId: string,
  limit: number = LOGS_MAX_ROWS,
): string {
  const id = aplString(workspaceId)
  return [
    datasetRef(dataset),
    `| extend ws_request = ${opt('request.workspaceId')}, ws_fields = ${opt('fields.workspaceId')}`,
    `| where ws_request == ${id} or ws_fields == ${id}`,
    '| project time = _time' +
      `, level = ${opt('level')}` +
      `, source = ${opt('source')}` +
      `, message = ${opt('message')}` +
      `, method = ${opt('request.method')}` +
      `, path = ${opt('request.path')}` +
      `, status = ${opt('request.statusCode')}` +
      `, userId = ${opt('request.userId')}` +
      `, category = ${opt('fields.category')}` +
      `, entity = ${opt('fields.entity')}` +
      `, action = ${opt('fields.action')}` +
      `, actorId = ${opt('fields.actorId')}` +
      `, targetId = ${opt('fields.targetId')}` +
      `, outcome = ${opt('fields.outcome')}` +
      `, detail = ${opt('fields.detail')}`,
    '| sort by time desc',
    `| limit ${Math.max(1, Math.floor(limit))}`,
  ].join('\n')
}

function cell(row: AplRow, column: string): string | null {
  const value = row[column]
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' ? value : String(value)
}

export function logRowsToCsv(rows: AplRow[]): string {
  return csvDocument(
    [...LOG_COLUMNS],
    rows.map((row) => LOG_COLUMNS.map((column) => cell(row, column))),
  )
}

/** One JSON object per line, only the known columns (empty ones dropped). */
export function logRowsToNdjson(rows: AplRow[]): string {
  return rows
    .map((row) => {
      const out: Record<string, string> = {}
      for (const column of LOG_COLUMNS) {
        const value = cell(row, column)
        if (value !== null) out[column] = value
      }
      return `${JSON.stringify(out)}\n`
    })
    .join('')
}

export function logsReadMe(input: {
  workspaceName: string
  from: Date
  to: Date
  rows: number
  truncated: boolean
}): string {
  return [
    `Logs do workspace "${input.workspaceName}"`,
    `Período: ${input.from.toISOString()} a ${input.to.toISOString()} (UTC).`,
    `Eventos: ${input.rows}${input.truncated ? ` (limite de ${LOGS_MAX_ROWS} atingido: os mais antigos ficaram de fora — exporte um período menor)` : ''}.`,
    '',
    'Conteúdo',
    '- logs.csv: um evento por linha (requisições à API e eventos de auditoria).',
    '- logs.ndjson: os mesmos eventos, um JSON por linha.',
    '',
    'Colunas: time (UTC), level, source, message, method, path, status, userId',
    '(requisições); category, entity, action, actorId, targetId, outcome',
    '(auditoria); detail (dados extras do evento). O endereço IP, o país e a',
    'cidade de quem fez a requisição e o corpo das requisições não são',
    'exportados.',
    '',
  ].join('\r\n')
}
