export type SdNotificationChannelDTO = 'IN_APP' | 'EMAIL' | 'WHATSAPP'

export type SdNotificationAudienceDTO =
  | 'assignee'
  | 'participants'
  | 'followers'
  | 'requester'
  | 'contact'
  | 'departmentLeads'
  | 'mentioned'

/** Uma linha da matriz de preferências (evento) com o estado de cada canal. */
export interface SdNotificationEventPreferenceDTO {
  event: string
  label: string
  description: string
  audience: SdNotificationAudienceDTO[]
  agentOnly: boolean
  /** Canais oferecidos para este evento. */
  channels: SdNotificationChannelDTO[]
  /** Canais ligados por padrão (catálogo). */
  defaultChannels: SdNotificationChannelDTO[]
  /** Canais ligados agora (padrão + o que o usuário salvou). */
  enabledChannels: SdNotificationChannelDTO[]
  /** `true` quando há ao menos uma preferência salva para o evento. */
  customized: boolean
}

export interface SdNotificationGroupDTO {
  label: string
  events: SdNotificationEventPreferenceDTO[]
}

/** `GET .../servicedesk/notification-preferences`. */
export interface SdNotificationPreferencesDTO {
  /** Papel do usuário no módulo (esconde eventos `agentOnly`). */
  isAgent: boolean
  /** `true` quando o workspace tem conexão de WhatsApp do ServiceDesk ativa. */
  whatsappAvailable: boolean
  groups: SdNotificationGroupDTO[]
}

/** Quem segue o chamado. */
export interface SdTicketFollowerDTO {
  userId: string
  name: string
  email: string
  image: string | null
  followedAt: string
}

export interface SdTicketFollowersDTO {
  items: SdTicketFollowerDTO[]
  /** O usuário da sessão está na lista? */
  following: boolean
}
