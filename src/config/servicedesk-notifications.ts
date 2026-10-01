import type { SdNotificationChannel } from '@prisma/client'

/**
 * Catálogo de notificações do ServiceDesk: o que o módulo avisa, para quem e
 * por quais canais por padrão. A preferência do usuário
 * (`SdNotificationPreference`) só liga/desliga um par evento × canal; sem
 * linha salva, vale o padrão daqui.
 *
 * Público (`audience`) é resolvido no envio: `assignee` (responsável),
 * `participants`, `followers` (quem segue), `requester` (solicitante),
 * `contact` (contato externo, via e-mail/WhatsApp), `departmentLeads`
 * (líderes do time) e `mentioned` (citados na mensagem).
 */

export const SD_NOTIFICATION_AUDIENCES = [
  'assignee',
  'participants',
  'followers',
  'requester',
  'contact',
  'departmentLeads',
  'mentioned',
] as const

export type SdNotificationAudience = (typeof SD_NOTIFICATION_AUDIENCES)[number]

export interface SdNotificationEventSpec {
  /** Chave estável usada na preferência e no log. */
  key: string
  label: string
  description: string
  audience: SdNotificationAudience[]
  /** Canais oferecidos ao usuário para este evento. */
  channels: SdNotificationChannel[]
  /** Canais ligados quando o usuário não mexeu em nada. */
  defaultChannels: SdNotificationChannel[]
  /** Só faz sentido para agente (não aparece para solicitante/contato). */
  agentOnly?: boolean
}

const ALL: SdNotificationChannel[] = ['IN_APP', 'EMAIL', 'WHATSAPP']
const APP_MAIL: SdNotificationChannel[] = ['IN_APP', 'EMAIL']

export const SD_NOTIFICATION_EVENTS: SdNotificationEventSpec[] = [
  {
    key: 'ticket.assigned',
    label: 'Chamado atribuído a você',
    description: 'Quando um chamado passa a ser seu.',
    audience: ['assignee'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'ticket.created_in_department',
    label: 'Chamado novo na sua fila',
    description: 'Abertura de chamado no departamento em que você atende.',
    audience: ['departmentLeads'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
  {
    key: 'ticket.message',
    label: 'Nova mensagem no chamado',
    description: 'Resposta pública no histórico de um chamado que você segue.',
    audience: ['assignee', 'participants', 'followers', 'requester', 'contact'],
    channels: ALL,
    defaultChannels: APP_MAIL,
  },
  {
    key: 'ticket.internal_note',
    label: 'Nota interna',
    description: 'Nota interna registrada no chamado (nunca vai ao cliente).',
    audience: ['assignee', 'participants', 'followers'],
    channels: ['IN_APP'],
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
  {
    key: 'ticket.mentioned',
    label: 'Você foi citado',
    description: 'Alguém citou você numa mensagem do chamado.',
    audience: ['mentioned'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'ticket.phase_changed',
    label: 'Mudança de fase',
    description: 'O chamado avançou (ou voltou) de fase.',
    audience: ['assignee', 'participants', 'followers', 'requester', 'contact'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
  },
  {
    key: 'ticket.resolved',
    label: 'Chamado resolvido',
    description: 'A solução foi registrada e o chamado foi resolvido.',
    audience: ['requester', 'contact', 'participants', 'followers'],
    channels: ALL,
    defaultChannels: APP_MAIL,
  },
  {
    key: 'ticket.reopened',
    label: 'Chamado reaberto',
    description: 'O solicitante respondeu e o chamado voltou para a fila.',
    audience: ['assignee', 'departmentLeads', 'followers'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'sla.at_risk',
    label: 'SLA em risco',
    description: 'O prazo está perto do limite configurado.',
    audience: ['assignee', 'departmentLeads'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'sla.breached',
    label: 'SLA violado',
    description: 'O prazo de resposta ou de resolução estourou.',
    audience: ['assignee', 'departmentLeads'],
    channels: ALL,
    defaultChannels: ALL,
    agentOnly: true,
  },
  {
    key: 'ticket.escalated',
    label: 'Chamado escalonado',
    description: 'Escalonamento funcional ou hierárquico registrado.',
    audience: ['assignee', 'departmentLeads', 'followers'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'approval.requested',
    label: 'Aprovação solicitada',
    description: 'Pedido de aprovação enviado a você.',
    audience: ['participants'],
    channels: APP_MAIL,
    defaultChannels: APP_MAIL,
  },
  {
    key: 'approval.responded',
    label: 'Aprovação respondida',
    description: 'Um aprovador aprovou ou reprovou.',
    audience: ['assignee', 'participants', 'followers'],
    channels: APP_MAIL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'task.assigned',
    label: 'Tarefa atribuída',
    description: 'Uma tarefa do chamado ficou com você.',
    audience: ['assignee'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
  {
    key: 'ticket.csat',
    label: 'Avaliação recebida',
    description: 'O solicitante avaliou o atendimento.',
    audience: ['assignee', 'departmentLeads'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
]

const BY_KEY = new Map(SD_NOTIFICATION_EVENTS.map((e) => [e.key, e]))

export function sdNotificationEvent(
  key: string,
): SdNotificationEventSpec | undefined {
  return BY_KEY.get(key)
}

/** O canal está ligado para este evento quando o usuário não escolheu nada? */
export function sdNotificationDefault(
  key: string,
  channel: SdNotificationChannel,
): boolean {
  return BY_KEY.get(key)?.defaultChannels.includes(channel) ?? false
}
