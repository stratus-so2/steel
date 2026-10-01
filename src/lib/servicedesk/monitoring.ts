import { createHash } from 'node:crypto'
import type { SdMonitorSeverityMapEntryDTO } from '@/src/schemas/sd-monitor-source.schema'

export {
  SD_GENERIC_PAYLOAD_EXAMPLE,
  SD_ZABBIX_MEDIA_TYPE_FIELDS,
  sdZabbixPayloadExample,
} from './monitor-fields'

/**
 * Leitura do alerta que chega na entrada pública de monitoramento.
 *
 * O mesmo parser atende as duas formas aceitas — o `kind` da origem só muda
 * o texto de ajuda e o snippet mostrado na tela, porque o script do tipo de
 * mídia do Zabbix é escrito pelo próprio cliente e costuma misturar os dois
 * jeitos de nomear os campos.
 *
 * **Zabbix** (tipo de mídia "Webhook", campos do script — veja
 * `SD_ZABBIX_MEDIA_TYPE_FIELDS`):
 *
 * | Campo          | Macro             | Uso |
 * | -------------- | ----------------- | --- |
 * | `eventId`      | `{EVENT.ID}`      | deduplicação `(origem, eventId)` |
 * | `eventValue`   | `{EVENT.VALUE}`   | `1` = problema, `0` = normalizado |
 * | `eventStatus`  | `{EVENT.STATUS}`  | `PROBLEM` / `RESOLVED` |
 * | `eventName`    | `{EVENT.NAME}`    | título do chamado |
 * | `eventSeverity`| `{EVENT.SEVERITY}`| mapa severidade → prioridade |
 * | `eventDate`    | `{EVENT.DATE}`    | início do alerta (`2026.10.01`) |
 * | `eventTime`    | `{EVENT.TIME}`    | início do alerta (`14:03:12`) |
 * | `eventTags`    | `{EVENT.TAGS}`    | tags, separadas por vírgula |
 * | `hostName`     | `{HOST.NAME}`     | vínculo com o item de configuração |
 * | `hostIp`       | `{HOST.IP}`       | vínculo com o item de configuração |
 * | `message`      | `{ALERT.MESSAGE}` | corpo do chamado |
 *
 * **Genérico**: `{ externalId, status, severity, host, subject, body, tags,
 * startedAt }` — `status` aceita `PROBLEM`/`FIRING`/`OK`/`RESOLVED`.
 */

export interface SdMonitorEvent {
  /** Chave de deduplicação dentro da origem. */
  externalId: string
  /** `true` quando o alerta normalizou (OK / RESOLVED / `value` 0). */
  resolved: boolean
  severity: string | null
  host: string | null
  subject: string
  body: string | null
  tags: string[]
  /** Início informado pela origem (`null` = usa a hora do recebimento). */
  startedAt: Date | null
}

const MAX_SUBJECT = 200
const MAX_BODY = 8000
const MAX_TAGS = 20

const ID_KEYS = [
  'externalId',
  'external_id',
  'eventId',
  'event_id',
  'eventid',
  'alertId',
  'fingerprint',
  'id',
]
const STATUS_KEYS = [
  'status',
  'eventStatus',
  'event_status',
  'state',
  'alertStatus',
]
const VALUE_KEYS = ['value', 'eventValue', 'event_value']
const SEVERITY_KEYS = [
  'severity',
  'eventSeverity',
  'event_severity',
  'priority',
  'level',
]
const HOST_KEYS = [
  'host',
  'hostName',
  'host_name',
  'hostname',
  'hostIp',
  'host_ip',
  'ip',
]
const SUBJECT_KEYS = [
  'subject',
  'alertSubject',
  'alert_subject',
  'eventName',
  'event_name',
  'name',
  'title',
]
const BODY_KEYS = [
  'body',
  'message',
  'alertMessage',
  'alert_message',
  'description',
  'details',
  'text',
]
const STARTED_KEYS = ['startedAt', 'started_at', 'timestamp', 'time', 'clock']
const TAG_KEYS = ['tags', 'eventTags', 'event_tags']

const RESOLVED_WORDS = new Set([
  'ok',
  'okay',
  'resolved',
  'resolve',
  'recovery',
  'recovered',
  'normal',
  'up',
  'close',
  'closed',
  'cleared',
  'clear',
  'false',
  'resolvido',
  'normalizado',
])

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null) return null
  if (Array.isArray(payload)) return null
  return payload as Record<string, unknown>
}

/** Primeiro valor escalar não vazio entre as chaves dadas. */
function pick(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
    if (typeof value === 'boolean') return String(value)
  }
  return undefined
}

function readTags(record: Record<string, unknown>): string[] {
  for (const key of TAG_KEYS) {
    const raw = record[key]
    let list: string[] | null = null
    if (Array.isArray(raw)) {
      list = raw.filter((t): t is string => typeof t === 'string')
    } else if (typeof raw === 'string') {
      list = raw.split(',')
    } else if (typeof raw === 'object' && raw !== null) {
      list = Object.entries(raw as Record<string, unknown>).map(
        ([name, value]) => `${name}: ${String(value)}`,
      )
    }
    if (!list) continue
    const cleaned = [
      ...new Set(list.map((t) => t.trim()).filter((t) => t !== '')),
    ]
    if (cleaned.length > 0) return cleaned.slice(0, MAX_TAGS)
  }
  return []
}

/** `2026.10.01` + `14:03:12` (Zabbix) ou qualquer data que o `Date` entenda. */
function readStartedAt(record: Record<string, unknown>): Date | null {
  const date = pick(record, ['eventDate', 'event_date'])
  const time = pick(record, ['eventTime', 'event_time'])
  if (date) {
    const iso = `${date.replace(/\./g, '-')}T${time ?? '00:00:00'}`
    const parsed = new Date(iso)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  const raw = pick(record, STARTED_KEYS)
  if (!raw) return null
  // Epoch em segundos (`{EVENT.TIMESTAMP}` do Zabbix) ou em milissegundos.
  if (/^\d{9,14}$/.test(raw)) {
    const n = Number(raw)
    const parsed = new Date(raw.length > 11 ? n : n * 1000)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function readResolved(record: Record<string, unknown>): boolean {
  const status = pick(record, STATUS_KEYS)
  if (status) return RESOLVED_WORDS.has(status.toLowerCase())
  const value = pick(record, VALUE_KEYS)
  // `{EVENT.VALUE}`: 1 = problema, 0 = normalizado.
  if (value) return value === '0' || RESOLVED_WORDS.has(value.toLowerCase())
  return false
}

/**
 * Normaliza o corpo recebido. Devolve `null` quando não dá para montar um
 * alerta (sem assunto reconhecível) — a rota responde
 * `SD_MONITOR_PAYLOAD_INVALID`.
 *
 * Sem `externalId` explícito, a chave de deduplicação vira o SHA-256 de
 * `host|assunto` (`auto:…`): o mesmo alerta reenviado continua caindo no
 * mesmo chamado.
 */
export function parseSdMonitorPayload(payload: unknown): SdMonitorEvent | null {
  const record = asRecord(payload)
  if (!record) return null

  const host = pick(record, HOST_KEYS) ?? null
  const bodyRaw = pick(record, BODY_KEYS) ?? null
  const subjectRaw = pick(record, SUBJECT_KEYS) ?? bodyRaw
  if (!subjectRaw) return null

  const subject = subjectRaw.split('\n')[0].trim().slice(0, MAX_SUBJECT)
  if (subject === '') return null

  const explicitId = pick(record, ID_KEYS)
  const externalId = explicitId
    ? explicitId.slice(0, 200)
    : `auto:${createHash('sha256')
        .update(`${host ?? ''}|${subject}`)
        .digest('hex')
        .slice(0, 32)}`

  return {
    externalId,
    resolved: readResolved(record),
    severity: pick(record, SEVERITY_KEYS)?.slice(0, 60) ?? null,
    host,
    subject,
    body: bodyRaw ? bodyRaw.slice(0, MAX_BODY) : null,
    tags: readTags(record),
    startedAt: readStartedAt(record),
  }
}

/** Prioridade configurada para a severidade do alerta (sem diferenciar caixa). */
export function sdMonitorPriorityId(
  severityMap: SdMonitorSeverityMapEntryDTO[],
  severity: string | null,
): string | null {
  if (!severity) return null
  const wanted = severity.trim().toLowerCase()
  return (
    severityMap.find((entry) => entry.from.trim().toLowerCase() === wanted)
      ?.priorityId ?? null
  )
}

/** Lê o `severityMap` guardado como JSON, ignorando entradas inválidas. */
export function sdMonitorSeverityMap(
  raw: unknown,
): SdMonitorSeverityMapEntryDTO[] {
  if (!Array.isArray(raw)) return []
  const entries: SdMonitorSeverityMapEntryDTO[] = []
  for (const item of raw) {
    const record = asRecord(item)
    const from = record && pick(record, ['from'])
    const priorityId = record && pick(record, ['priorityId'])
    if (from && priorityId) entries.push({ from, priorityId })
  }
  return entries
}

/** Descrição HTML do chamado aberto pelo alerta. */
export function sdMonitorTicketBody(
  event: SdMonitorEvent,
  sourceName: string,
): string {
  const rows: [string, string][] = [['Origem', sourceName]]
  if (event.host) rows.push(['Host', event.host])
  if (event.severity) rows.push(['Severidade', event.severity])
  rows.push(['Identificador', event.externalId])
  if (event.tags.length > 0) rows.push(['Tags', event.tags.join(', ')])

  const list = rows
    .map(
      ([label, value]) =>
        `<li><strong>${esc(label)}:</strong> ${esc(value)}</li>`,
    )
    .join('')
  const message = event.body
    ? `<p>${esc(event.body).replace(/\n/g, '<br />')}</p>`
    : ''
  return `<p>Chamado aberto automaticamente pelo monitoramento.</p><ul>${list}</ul>${message}`
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
