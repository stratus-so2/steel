import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Parte pura das integrações do ServiceDesk (Slack e GitHub): verificação de
 * assinatura dos webhooks, leitura do `config` da integração, reconhecimento
 * de referências de issue/PR e o texto das mensagens enviadas.
 *
 * Nada aqui faz I/O — nem rede, nem banco, nem `process.env` — para o
 * webhook poder ser testado sem subir nada.
 */

/* ------------------------------ assinatura ------------------------------ */

/** Janela de tolerância do timestamp do Slack (o padrão da própria Slack). */
export const SLACK_TIMESTAMP_TOLERANCE_SECONDS = 300

/** Compara em tempo constante, sem vazar o tamanho do segredo. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export interface SlackSignatureInput {
  signingSecret: string
  /** `X-Slack-Request-Timestamp` (segundos, em texto). */
  timestamp: string | null
  /** `X-Slack-Signature` (`v0=<hex>`). */
  signature: string | null
  /** Corpo **bruto**, como chegou — a assinatura é sobre ele. */
  rawBody: string
  /** Agora, em milissegundos (injetado para o teste não depender do relógio). */
  now?: number
}

export type SlackSignatureResult = 'valid' | 'invalid' | 'stale'

/**
 * `v0:<timestamp>:<corpo>` assinado com HMAC-SHA256 do *signing secret* do
 * app. Timestamp fora da janela de 5 minutos é recusado como `stale` (defesa
 * contra replay) **antes** de comparar o HMAC.
 */
export function verifySlackSignature(
  input: SlackSignatureInput,
): SlackSignatureResult {
  const { signingSecret, timestamp, signature, rawBody } = input
  if (!signingSecret || !timestamp || !signature) return 'invalid'

  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds)) return 'invalid'
  const now = input.now ?? Date.now()
  if (Math.abs(now / 1000 - seconds) > SLACK_TIMESTAMP_TOLERANCE_SECONDS) {
    return 'stale'
  }

  const expected = `v0=${createHmac('sha256', signingSecret)
    .update(`v0:${timestamp}:${rawBody}`, 'utf8')
    .digest('hex')}`
  return constantTimeEqual(expected, signature) ? 'valid' : 'invalid'
}

/**
 * `X-Hub-Signature-256: sha256=<hex>` sobre o corpo bruto, com o segredo do
 * webhook do repositório.
 */
export function verifyGithubSignature(input: {
  secret: string
  signature: string | null
  rawBody: string
}): boolean {
  const { secret, signature, rawBody } = input
  if (!secret || !signature?.startsWith('sha256=')) return false
  const expected = `sha256=${createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')}`
  return constantTimeEqual(expected, signature)
}

/* -------------------------------- config -------------------------------- */

/** Canal do Slack de um time (departamento `null` = canal padrão). */
export interface SdSlackChannelMap {
  departmentId: string | null
  channelId: string
  channelName: string | null
}

/** Preferências guardadas em `SdIntegration.config` (coluna JSON). */
export interface SdSlackConfig {
  channels: SdSlackChannelMap[]
  /** Chaves de `SD_NOTIFICATION_EVENTS` que vão para o Slack. */
  events: string[]
  /** Abrir chamado a partir de mensagem (atalho / slash command). */
  allowTicketFromMessage: boolean
  /** Resposta na thread vira mensagem pública no histórico. */
  mirrorThreadReplies: boolean
  /** Tipo do chamado aberto a partir de uma mensagem do Slack. */
  ticketType: SdSlackTicketType
  /** Time que recebe o chamado aberto pelo Slack. */
  departmentId: string | null
}

export interface SdGithubConfig {
  /** Fechar/mesclar a issue **sugere** a mudança de fase (não executa). */
  suggestPhaseOnClose: boolean
  /** Abrir issue a partir do chamado (problema e mudança). */
  allowIssueFromTicket: boolean
}

export const SD_SLACK_TICKET_TYPES = [
  'INCIDENT',
  'SERVICE_REQUEST',
  'CHANGE',
  'PROBLEM',
] as const

export type SdSlackTicketType = (typeof SD_SLACK_TICKET_TYPES)[number]

export const SD_SLACK_CONFIG_DEFAULTS: SdSlackConfig = {
  channels: [],
  events: ['ticket.created_in_department', 'sla.breached', 'ticket.escalated'],
  allowTicketFromMessage: true,
  mirrorThreadReplies: true,
  ticketType: 'INCIDENT',
  departmentId: null,
}

export const SD_GITHUB_CONFIG_DEFAULTS: SdGithubConfig = {
  suggestPhaseOnClose: true,
  allowIssueFromTicket: true,
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** `config` do banco → `SdSlackConfig` completo (nunca lança). */
export function parseSdSlackConfig(value: unknown): SdSlackConfig {
  const raw = asRecord(value)
  const channels: SdSlackChannelMap[] = []
  const seen = new Set<string>()
  for (const entry of Array.isArray(raw.channels) ? raw.channels : []) {
    const row = asRecord(entry)
    const channelId = asString(row.channelId)
    if (!channelId) continue
    const departmentId = asString(row.departmentId)
    const key = departmentId ?? '*'
    if (seen.has(key)) continue
    seen.add(key)
    channels.push({
      departmentId,
      channelId,
      channelName: asString(row.channelName),
    })
  }
  const events = Array.isArray(raw.events)
    ? [...new Set(raw.events.filter((e): e is string => typeof e === 'string'))]
    : SD_SLACK_CONFIG_DEFAULTS.events
  const ticketType = SD_SLACK_TICKET_TYPES.find((t) => t === raw.ticketType)
  return {
    channels,
    events,
    allowTicketFromMessage: asBoolean(
      raw.allowTicketFromMessage,
      SD_SLACK_CONFIG_DEFAULTS.allowTicketFromMessage,
    ),
    mirrorThreadReplies: asBoolean(
      raw.mirrorThreadReplies,
      SD_SLACK_CONFIG_DEFAULTS.mirrorThreadReplies,
    ),
    ticketType: ticketType ?? SD_SLACK_CONFIG_DEFAULTS.ticketType,
    departmentId: asString(raw.departmentId),
  }
}

export function parseSdGithubConfig(value: unknown): SdGithubConfig {
  const raw = asRecord(value)
  return {
    suggestPhaseOnClose: asBoolean(
      raw.suggestPhaseOnClose,
      SD_GITHUB_CONFIG_DEFAULTS.suggestPhaseOnClose,
    ),
    allowIssueFromTicket: asBoolean(
      raw.allowIssueFromTicket,
      SD_GITHUB_CONFIG_DEFAULTS.allowIssueFromTicket,
    ),
  }
}

/**
 * Canal que recebe o evento: o do departamento do chamado, senão o canal
 * padrão (`departmentId: null`). Sem nenhum dos dois, o evento não é
 * entregue.
 */
export function sdSlackChannelFor(
  config: SdSlackConfig,
  departmentId: string | null,
): string | null {
  const exact = departmentId
    ? config.channels.find((c) => c.departmentId === departmentId)
    : undefined
  const fallback = config.channels.find((c) => c.departmentId === null)
  return exact?.channelId ?? fallback?.channelId ?? null
}

/* ------------------------------ referências ------------------------------ */

export interface SdGithubRepoRef {
  owner: string
  repo: string
}

const SEGMENT = /^[A-Za-z0-9._-]+$/

/** `owner/repo`, `https://github.com/owner/repo` ou `…/owner/repo.git`. */
export function parseSdGithubRepo(input: string): SdGithubRepoRef | null {
  const trimmed = input.trim().replace(/\.git$/, '')
  if (trimmed === '') return null
  const withoutHost = trimmed
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  const parts = withoutHost.split('/')
  if (parts.length !== 2) return null
  const [owner, repo] = parts
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) return null
  return { owner, repo }
}

export type SdGithubRefKind = 'GITHUB_ISSUE' | 'GITHUB_PULL_REQUEST'

export interface SdGithubItemRef {
  owner: string | null
  repo: string | null
  number: number
  /** `null` quando a referência é só um número (`#42`) — o tipo vem da API. */
  kind: SdGithubRefKind | null
}

/**
 * Referência de issue/PR: `#42`, `42`, `owner/repo#42` ou a URL completa
 * (`https://github.com/owner/repo/issues/42` ou `/pull/42`).
 */
export function parseSdGithubItemRef(input: string): SdGithubItemRef | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  const url = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/(issues|pull)\/(\d+)/i,
  )
  if (url) {
    return {
      owner: url[1],
      repo: url[2],
      number: Number(url[4]),
      kind:
        url[3].toLowerCase() === 'pull'
          ? 'GITHUB_PULL_REQUEST'
          : 'GITHUB_ISSUE',
    }
  }

  const scoped = trimmed.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)#(\d+)$/)
  if (scoped) {
    return {
      owner: scoped[1],
      repo: scoped[2],
      number: Number(scoped[3]),
      kind: null,
    }
  }

  const plain = trimmed.match(/^#?(\d+)$/)
  if (plain) {
    const number = Number(plain[1])
    if (number <= 0) return null
    return { owner: null, repo: null, number, kind: null }
  }
  return null
}

/** `externalId` da integração do GitHub: sempre `owner/repo`. */
export function sdGithubRepoKey(ref: SdGithubRepoRef): string {
  return `${ref.owner}/${ref.repo}`
}

/** `externalKey` do vínculo: `owner/repo#numero`. */
export function sdGithubLinkKey(ref: SdGithubRepoRef, number: number): string {
  return `${sdGithubRepoKey(ref)}#${number}`
}

export function sdGithubItemUrl(
  ref: SdGithubRepoRef,
  number: number,
  kind: SdGithubRefKind,
): string {
  const segment = kind === 'GITHUB_PULL_REQUEST' ? 'pull' : 'issues'
  return `https://github.com/${ref.owner}/${ref.repo}/${segment}/${number}`
}

/** `externalKey` da thread do Slack: `<canal>:<ts>`. */
export function sdSlackThreadKey(channel: string, ts: string): string {
  return `${channel}:${ts}`
}

export function parseSdSlackThreadKey(
  key: string,
): { channel: string; ts: string } | null {
  const index = key.indexOf(':')
  if (index <= 0 || index === key.length - 1) return null
  return { channel: key.slice(0, index), ts: key.slice(index + 1) }
}

/* ------------------------------- estados ------------------------------- */

export type SdGithubExternalState = 'open' | 'closed' | 'merged'

/** Estado exibível de um item do GitHub a partir do payload/API. */
export function sdGithubState(item: {
  state?: string | null
  merged?: boolean | null
  merged_at?: string | null
  pull_request?: { merged_at?: string | null } | null
}): SdGithubExternalState {
  if (item.merged === true || item.merged_at || item.pull_request?.merged_at) {
    return 'merged'
  }
  return item.state === 'closed' ? 'closed' : 'open'
}

export const SD_GITHUB_STATE_LABEL: Record<SdGithubExternalState, string> = {
  open: 'Aberta',
  closed: 'Fechada',
  merged: 'Mesclada',
}

/* ------------------------------- mensagens ------------------------------- */

/** Escapa o mínimo que o Slack interpreta em texto (`mrkdwn`). */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Texto do aviso enviado ao canal do time. */
export function sdSlackEventText(input: {
  ticketCode: string
  ticketTitle: string
  title: string
  body: string
  url: string
}): string {
  const link = `<${input.url}|${escapeSlackText(input.ticketCode)}>`
  const lines = [
    `*${escapeSlackText(input.title)}*`,
    `${link} — ${escapeSlackText(input.ticketTitle)}`,
  ]
  const body = input.body.trim()
  if (body) lines.push(escapeSlackText(body))
  return lines.join('\n')
}

/** Resposta na thread confirmando o chamado aberto a partir da mensagem. */
export function sdSlackTicketOpenedText(input: {
  ticketCode: string
  url: string
}): string {
  return `:ticket: Chamado *<${input.url}|${escapeSlackText(input.ticketCode)}>* aberto no ServiceDesk a partir desta mensagem. As respostas nesta thread entram no histórico do chamado.`
}

/** Corpo HTML do chamado aberto a partir de uma mensagem do Slack. */
export function sdSlackTicketBody(input: {
  text: string
  authorName: string
  channelName: string | null
  permalink: string | null
}): string {
  const body = escapeHtml(input.text.trim())
  const parts = [`<p>${body || '(mensagem sem texto)'}</p>`]
  const where = input.channelName
    ? `#${escapeHtml(input.channelName)}`
    : 'Slack'
  parts.push(
    `<p><em>Aberto a partir de uma mensagem de ${escapeHtml(
      input.authorName,
    )} em ${where}.</em></p>`,
  )
  if (input.permalink) {
    parts.push(
      `<p><a href="${escapeHtml(input.permalink)}">Mensagem original no Slack</a></p>`,
    )
  }
  return parts.join('')
}

/** Título do chamado a partir da primeira linha da mensagem do Slack. */
export function sdSlackTicketTitle(text: string): string {
  const firstLine = text
    .trim()
    .replace(/\n[\s\S]*$/, '')
    .trim()
  if (firstLine === '') return 'Chamado aberto pelo Slack'
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
}

/** Mensagem pública registrada no histórico a partir de uma resposta na thread. */
export function sdSlackReplyBody(input: {
  text: string
  authorName: string
  identified: boolean
}): string {
  const body = escapeHtml(input.text.trim())
  const who = escapeHtml(input.authorName)
  const prefix = input.identified
    ? '<p><em>Resposta pelo Slack.</em></p>'
    : `<p><em>Resposta pelo Slack de ${who} (usuário externo).</em></p>`
  return `${prefix}<p>${body || '(mensagem sem texto)'}</p>`
}

/** Título/corpo da issue aberta a partir do chamado. */
export function sdGithubIssueFromTicket(input: {
  ticketCode: string
  ticketTitle: string
  ticketUrl: string
  description: string | null
  ticketType: string
  priority: string | null
}): { title: string; body: string } {
  const lines = [
    `Chamado **${input.ticketCode}** do ServiceDesk.`,
    '',
    `- Tipo: ${input.ticketType}`,
    ...(input.priority ? [`- Prioridade: ${input.priority}`] : []),
    `- Chamado: ${input.ticketUrl}`,
  ]
  const description = (input.description ?? '').trim()
  if (description) lines.push('', '---', '', description)
  return {
    title: `[${input.ticketCode}] ${input.ticketTitle}`,
    body: lines.join('\n'),
  }
}

/** Mensagem pública que registra a mudança de estado do item do GitHub. */
export function sdGithubStateChangeBody(input: {
  kind: SdGithubRefKind
  key: string
  url: string | null
  state: SdGithubExternalState
  suggestPhase: boolean
}): string {
  const what =
    input.kind === 'GITHUB_PULL_REQUEST' ? 'O pull request' : 'A issue'
  const label = SD_GITHUB_STATE_LABEL[input.state].toLowerCase()
  const ref = input.url
    ? `<a href="${escapeHtml(input.url)}">${escapeHtml(input.key)}</a>`
    : escapeHtml(input.key)
  const lines = [`<p>${what} ${ref} do GitHub agora está ${label}.</p>`]
  if (input.suggestPhase && input.state !== 'open') {
    lines.push(
      '<p><em>Sugestão: o trabalho técnico terminou — revise a solução e avance a fase do chamado se for o caso.</em></p>',
    )
  }
  return lines.join('')
}
