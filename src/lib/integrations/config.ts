import {
  parseSdGithubConfig,
  parseSdSlackConfig,
  type SdGithubConfig,
  type SdSlackChannelMap,
  type SdSlackConfig,
} from '@/src/lib/servicedesk/integrations'
import {
  DEFAULT_WAITING_MINUTES,
  integrationNotificationEvent,
  MAX_WAITING_MINUTES,
  MIN_WAITING_MINUTES,
  SD_SLACK_EVENT_PREFIX,
  sdSlackEventKey,
} from './catalog'

/**
 * Shape of `WorkspaceIntegration.config` (JSON column) and the mapping from
 * the legacy ServiceDesk-only shape.
 *
 * Rows copied from `sd_integrations` by the migration keep their config
 * verbatim; it is mapped here **on read** (pure, idempotent) and persisted in
 * the new shape on the next write. Nothing here does I/O or throws.
 *
 * - Slack: `{ routes, waitingMinutes, servicedesk }` — one rule per
 *   (event, channel), plus the ServiceDesk module settings (channel per team,
 *   ticket from a Slack message, thread mirroring).
 * - GitHub / GitLab: `{ servicedesk: { suggestPhaseOnClose, allowIssueFromTicket } }`.
 */

export interface SlackNotificationRoute {
  /** Catalog key (`crm.deal.won`, `servicedesk.sla.breached`…). */
  event: string
  /**
   * `null` = "the team's channel only" (ServiceDesk events): delivered to
   * the channel mapped to the ticket's team, if any.
   */
  channelId: string | null
  channelName: string | null
}

/** ServiceDesk settings of the Slack connection (team channels only). */
export type SdSlackModuleConfig = Omit<SdSlackConfig, 'events'>

export interface WorkspaceSlackConfig {
  routes: SlackNotificationRoute[]
  /** Comunicação: minutes before "conversation waiting" is announced. */
  waitingMinutes: number
  servicedesk: SdSlackModuleConfig
}

export interface WorkspaceRepoConfig {
  servicedesk: SdGithubConfig
}

/** Upper bound of rules per workspace (one per event × channel). */
export const MAX_SLACK_ROUTES = 120

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Old `sd_integrations.config` of a Slack row: top-level events/channels. */
export function isLegacySlackConfig(value: unknown): boolean {
  const raw = asRecord(value)
  return (
    !('routes' in raw) &&
    !('servicedesk' in raw) &&
    ('events' in raw || 'channels' in raw)
  )
}

/** Old `sd_integrations.config` of a GitHub row: the two flags at the top. */
export function isLegacyRepoConfig(value: unknown): boolean {
  const raw = asRecord(value)
  return (
    !('servicedesk' in raw) &&
    ('suggestPhaseOnClose' in raw || 'allowIssueFromTicket' in raw)
  )
}

function sdModuleFrom(config: SdSlackConfig): SdSlackModuleConfig {
  return {
    channels: config.channels.filter((row) => row.departmentId !== null),
    allowTicketFromMessage: config.allowTicketFromMessage,
    mirrorThreadReplies: config.mirrorThreadReplies,
    ticketType: config.ticketType,
    departmentId: config.departmentId,
  }
}

/**
 * Legacy ServiceDesk Slack config → workspace config. The default channel
 * (`departmentId: null`) becomes the channel of one rule per selected event;
 * without a default channel the rules are "team channel only", which is
 * exactly what the old dispatcher did (team channel, else nothing).
 */
export function mapLegacySlackConfig(value: unknown): WorkspaceSlackConfig {
  const legacy = parseSdSlackConfig(value)
  const fallback = legacy.channels.find((row) => row.departmentId === null)
  return {
    routes: legacy.events.map((event) => ({
      event: sdSlackEventKey(event),
      channelId: fallback?.channelId ?? null,
      channelName: fallback?.channelName ?? null,
    })),
    waitingMinutes: DEFAULT_WAITING_MINUTES,
    servicedesk: sdModuleFrom(legacy),
  }
}

/** Valid, deduplicated rules (unknown events and bad channels dropped). */
export function parseSlackRoutes(value: unknown): SlackNotificationRoute[] {
  const routes: SlackNotificationRoute[] = []
  const seen = new Set<string>()
  for (const entry of Array.isArray(value) ? value : []) {
    const row = asRecord(entry)
    const event = asString(row.event)
    const spec = event ? integrationNotificationEvent(event) : null
    if (!event || !spec) continue
    const channelId = asString(row.channelId)
    if (!channelId && !spec.allowsTeamChannel) continue
    const key = `${event}|${channelId ?? '*'}`
    if (seen.has(key)) continue
    seen.add(key)
    routes.push({ event, channelId, channelName: asString(row.channelName) })
    if (routes.length >= MAX_SLACK_ROUTES) break
  }
  return routes
}

function clampWaiting(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_WAITING_MINUTES
  }
  return Math.min(
    MAX_WAITING_MINUTES,
    Math.max(MIN_WAITING_MINUTES, Math.round(value)),
  )
}

/** `config` of a Slack connection → full config (never throws). */
export function parseWorkspaceSlackConfig(
  value: unknown,
): WorkspaceSlackConfig {
  if (isLegacySlackConfig(value)) return mapLegacySlackConfig(value)
  const raw = asRecord(value)
  // The module block reuses the legacy parser (same fields); only team
  // channels are kept — the default channel lives in the rules now.
  const sd = parseSdSlackConfig({ ...asRecord(raw.servicedesk), events: [] })
  return {
    routes: parseSlackRoutes(raw.routes),
    waitingMinutes: clampWaiting(raw.waitingMinutes),
    servicedesk: sdModuleFrom(sd),
  }
}

/** `config` of a GitHub/GitLab connection → full config (never throws). */
export function parseWorkspaceRepoConfig(value: unknown): WorkspaceRepoConfig {
  if (isLegacyRepoConfig(value)) {
    return { servicedesk: parseSdGithubConfig(value) }
  }
  return { servicedesk: parseSdGithubConfig(asRecord(value).servicedesk) }
}

/**
 * Slack channels that receive `event`. `null` = the event is not routed (no
 * rule). For ServiceDesk events, the channel mapped to the ticket's team
 * replaces the rule channels; a "team channel only" rule without a team
 * channel delivers nowhere (`[]`).
 */
export function slackChannelsFor(
  config: WorkspaceSlackConfig,
  event: string,
  departmentId: string | null = null,
): string[] | null {
  const rules = config.routes.filter((route) => route.event === event)
  if (rules.length === 0) return null

  if (event.startsWith(SD_SLACK_EVENT_PREFIX) && departmentId) {
    const team = config.servicedesk.channels.find(
      (row: SdSlackChannelMap) => row.departmentId === departmentId,
    )
    if (team) return [team.channelId]
  }
  return [
    ...new Set(
      rules
        .map((route) => route.channelId)
        .filter((id): id is string => id !== null),
    ),
  ]
}
