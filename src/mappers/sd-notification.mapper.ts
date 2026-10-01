import type {
  SdNotificationChannel,
  SdNotificationPreference,
} from '@prisma/client'
import {
  SD_NOTIFICATION_EVENTS,
  SD_NOTIFICATION_GROUPS,
  type SdNotificationEventSpec,
} from '@/src/config/servicedesk-notifications'
import type { SdTicketFollowerRow } from '@/src/repositories/sd-notification.repository'
import type {
  SdNotificationChannelDTO,
  SdNotificationEventPreferenceDTO,
  SdNotificationGroupDTO,
  SdNotificationPreferencesDTO,
  SdTicketFollowerDTO,
} from '@/types/sd-notification'

/** `evento|canal` → ligado/desligado, a partir das linhas salvas. */
export function sdPreferenceIndex(
  rows: Pick<SdNotificationPreference, 'event' | 'channel' | 'enabled'>[],
): Map<string, boolean> {
  return new Map(
    rows.map((row) => [`${row.event}|${row.channel}`, row.enabled]),
  )
}

/** O canal está ligado para o usuário? Sem linha salva, vale o catálogo. */
export function sdChannelEnabled(
  spec: SdNotificationEventSpec,
  channel: SdNotificationChannel,
  saved: Map<string, boolean>,
): boolean {
  if (!spec.channels.includes(channel)) return false
  return (
    saved.get(`${spec.key}|${channel}`) ??
    spec.defaultChannels.includes(channel)
  )
}

function toEventDTO(
  spec: SdNotificationEventSpec,
  saved: Map<string, boolean>,
): SdNotificationEventPreferenceDTO {
  return {
    event: spec.key,
    label: spec.label,
    description: spec.description,
    audience: [...spec.audience],
    agentOnly: spec.agentOnly ?? false,
    channels: [...spec.channels] as SdNotificationChannelDTO[],
    defaultChannels: [...spec.defaultChannels] as SdNotificationChannelDTO[],
    enabledChannels: spec.channels.filter((channel) =>
      sdChannelEnabled(spec, channel, saved),
    ) as SdNotificationChannelDTO[],
    customized: spec.channels.some((channel) =>
      saved.has(`${spec.key}|${channel}`),
    ),
  }
}

const BY_KEY = new Map(SD_NOTIFICATION_EVENTS.map((spec) => [spec.key, spec]))

/**
 * Matriz evento × canal do usuário, agrupada por tema. Solicitantes não
 * veem eventos `agentOnly`, e grupos que ficam vazios somem.
 */
export function toSdNotificationPreferencesDTO(input: {
  rows: Pick<SdNotificationPreference, 'event' | 'channel' | 'enabled'>[]
  isAgent: boolean
  whatsappAvailable: boolean
}): SdNotificationPreferencesDTO {
  const saved = sdPreferenceIndex(input.rows)
  const groups: SdNotificationGroupDTO[] = []
  for (const group of SD_NOTIFICATION_GROUPS) {
    const events = group.events
      .map((key) => BY_KEY.get(key))
      .filter((spec): spec is SdNotificationEventSpec => spec !== undefined)
      .filter((spec) => input.isAgent || !spec.agentOnly)
      .map((spec) => toEventDTO(spec, saved))
    if (events.length > 0) groups.push({ label: group.label, events })
  }
  return {
    isAgent: input.isAgent,
    whatsappAvailable: input.whatsappAvailable,
    groups,
  }
}

export function toSdTicketFollowerDTO(
  row: SdTicketFollowerRow,
): SdTicketFollowerDTO {
  return {
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    image: row.user.image,
    followedAt: row.createdAt.toISOString(),
  }
}
