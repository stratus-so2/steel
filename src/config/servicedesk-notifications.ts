import type { NotificationKind, SdNotificationChannel } from '@prisma/client'

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
  /** Tipo da notificação in-app (`Notification.kind`). */
  kind: NotificationKind
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

/**
 * Resumo diário: preferência por usuário (desligada por padrão) lida pelo job
 * `servicedesk-digest`. Fica no catálogo para aparecer na mesma matriz da
 * tela de preferências, mas nunca passa pelo motor (`audience` vazio).
 */
export const SD_DIGEST_EVENT = 'digest.daily'

/** Hora local do workspace em que o resumo diário é enviado. */
export const SD_DIGEST_HOUR = 8

export const SD_NOTIFICATION_EVENTS: SdNotificationEventSpec[] = [
  {
    key: 'ticket.assigned',
    kind: 'SD_TICKET_ASSIGNED',
    label: 'Chamado atribuído a você',
    description: 'Quando um chamado passa a ser seu.',
    audience: ['assignee'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'ticket.created_in_department',
    kind: 'SD_TICKET_CREATED',
    label: 'Chamado novo na sua fila',
    description: 'Abertura de chamado no departamento em que você atende.',
    audience: ['departmentLeads'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
  {
    key: 'ticket.message',
    kind: 'SD_TICKET_MESSAGE',
    label: 'Nova mensagem no chamado',
    description: 'Resposta pública no histórico de um chamado que você segue.',
    audience: ['assignee', 'participants', 'followers', 'requester', 'contact'],
    channels: ALL,
    defaultChannels: APP_MAIL,
  },
  {
    key: 'ticket.internal_note',
    kind: 'SD_TICKET_MESSAGE',
    label: 'Nota interna',
    description: 'Nota interna registrada no chamado (nunca vai ao cliente).',
    audience: ['assignee', 'participants', 'followers'],
    channels: ['IN_APP'],
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
  {
    key: 'ticket.mentioned',
    kind: 'SD_TICKET_MENTIONED',
    label: 'Você foi citado',
    description: 'Alguém citou você numa mensagem do chamado.',
    audience: ['mentioned'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'ticket.phase_changed',
    kind: 'SD_TICKET_PHASE_CHANGED',
    label: 'Mudança de fase',
    description: 'O chamado avançou (ou voltou) de fase.',
    audience: ['assignee', 'participants', 'followers', 'requester', 'contact'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
  },
  {
    key: 'ticket.resolved',
    kind: 'SD_TICKET_RESOLVED',
    label: 'Chamado resolvido',
    description: 'A solução foi registrada e o chamado foi resolvido.',
    audience: ['requester', 'contact', 'participants', 'followers'],
    channels: ALL,
    defaultChannels: APP_MAIL,
  },
  {
    key: 'ticket.reopened',
    kind: 'SD_TICKET_REOPENED',
    label: 'Chamado reaberto',
    description: 'O solicitante respondeu e o chamado voltou para a fila.',
    audience: ['assignee', 'departmentLeads', 'followers'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'sla.at_risk',
    kind: 'SD_SLA_AT_RISK',
    label: 'SLA em risco',
    description: 'O prazo está perto do limite configurado.',
    audience: ['assignee', 'departmentLeads'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'sla.breached',
    kind: 'SD_SLA_BREACHED',
    label: 'SLA violado',
    description: 'O prazo de resposta ou de resolução estourou.',
    audience: ['assignee', 'departmentLeads'],
    channels: ALL,
    defaultChannels: ALL,
    agentOnly: true,
  },
  {
    key: 'ticket.escalated',
    kind: 'SD_TICKET_ESCALATED',
    label: 'Chamado escalonado',
    description: 'Escalonamento funcional ou hierárquico registrado.',
    audience: ['assignee', 'departmentLeads', 'followers'],
    channels: ALL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'approval.requested',
    kind: 'SD_APPROVAL_REQUESTED',
    label: 'Aprovação solicitada',
    description: 'Pedido de aprovação enviado a você.',
    audience: ['participants'],
    channels: APP_MAIL,
    defaultChannels: APP_MAIL,
  },
  {
    key: 'approval.responded',
    kind: 'SD_APPROVAL_RESPONDED',
    label: 'Aprovação respondida',
    description: 'Um aprovador aprovou ou reprovou.',
    audience: ['assignee', 'participants', 'followers'],
    channels: APP_MAIL,
    defaultChannels: APP_MAIL,
    agentOnly: true,
  },
  {
    key: 'task.assigned',
    kind: 'SD_TASK_ASSIGNED',
    label: 'Tarefa atribuída',
    description: 'Uma tarefa do chamado ficou com você.',
    audience: ['assignee'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
  {
    key: 'ticket.csat',
    kind: 'SD_TICKET_CSAT',
    label: 'Avaliação recebida',
    description: 'O solicitante avaliou o atendimento.',
    audience: ['assignee', 'departmentLeads'],
    channels: APP_MAIL,
    defaultChannels: ['IN_APP'],
    agentOnly: true,
  },
  {
    key: SD_DIGEST_EVENT,
    kind: 'SD_DIGEST',
    label: 'Resumo diário',
    description:
      'Uma vez por dia, no horário do workspace: o que ficou pendente com você (fila, SLA em risco, aguardando resposta).',
    // Sem público: não é disparado por um chamado, e sim pelo job
    // `servicedesk-digest`, que lê a preferência de cada agente.
    audience: [],
    channels: APP_MAIL,
    defaultChannels: [],
    agentOnly: true,
  },
]

/**
 * Agrupamento por tema da matriz de preferências (a ordem é a da tela).
 * Toda chave de `SD_NOTIFICATION_EVENTS` precisa estar em exatamente um
 * grupo — o teste do catálogo garante isso.
 */
export interface SdNotificationGroup {
  label: string
  events: string[]
}

export const SD_NOTIFICATION_GROUPS: SdNotificationGroup[] = [
  {
    label: 'Chamados',
    events: [
      'ticket.assigned',
      'ticket.created_in_department',
      'ticket.phase_changed',
      'ticket.resolved',
      'ticket.reopened',
      'ticket.csat',
    ],
  },
  {
    label: 'Conversas',
    events: ['ticket.message', 'ticket.internal_note', 'ticket.mentioned'],
  },
  {
    label: 'SLA e escalonamento',
    events: ['sla.at_risk', 'sla.breached', 'ticket.escalated'],
  },
  {
    label: 'Aprovações e tarefas',
    events: ['approval.requested', 'approval.responded', 'task.assigned'],
  },
  { label: 'Resumos', events: [SD_DIGEST_EVENT] },
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
