/**
 * Metadados de um tipo de notificação (`Notification.kind`): a que módulo
 * pertence, como se chama em pt-BR, que ícone e cor usar. Parte **pura** —
 * sem React, sem Prisma, sem I/O — para que o mapper, o service (filtro por
 * módulo) e a interface leiam a mesma tabela em vez de espalharem `switch`.
 *
 * Tipo novo entra em `NOTIFICATION_KINDS` (abaixo). Tipo desconhecido (de uma
 * versão mais nova do servidor, por exemplo) não quebra nada: o módulo é
 * inferido pelo prefixo (`SD_`, `WHATSAPP_`, `CRM_`) e o rótulo cai no nome
 * cru. É por isso que a função aceita `string`.
 */

/** Módulo que originou a notificação. `OTHER` = plataforma/base. */
export const NOTIFICATION_MODULES = [
  'SERVICE_DESK',
  'COMMUNICATION',
  'CRM',
  'OTHER',
] as const

export type NotificationModule = (typeof NOTIFICATION_MODULES)[number]

/**
 * Chave de ícone. Fica como string (e não como componente) para a lib
 * continuar pura: a interface resolve a chave num único mapa
 * (`app/_components/notifications/notification-kind-icon.tsx`).
 */
export const NOTIFICATION_ICONS = [
  'ticket',
  'ticket-check',
  'ticket-alert',
  'message',
  'mention',
  'alarm',
  'escalate',
  'approval',
  'task',
  'digest',
  'star',
  'chat',
  'deal',
  'bell',
] as const

export type NotificationIcon = (typeof NOTIFICATION_ICONS)[number]

export interface NotificationKindInfo {
  kind: string
  module: NotificationModule
  /** Nome do módulo em pt-BR (o "remetente" da linha). */
  moduleLabel: string
  /** O que aconteceu, em pt-BR (o "assunto técnico" da linha). */
  label: string
  icon: NotificationIcon
  /**
   * Cor base Tailwind do marcador. A interface monta
   * `bg-<c>-500/10 text-<c>-700 dark:text-<c>-300`, que é o padrão do repo e
   * funciona igual no claro e no escuro.
   */
  color: string
}

export const NOTIFICATION_MODULE_LABELS: Record<NotificationModule, string> = {
  SERVICE_DESK: 'ServiceDesk',
  COMMUNICATION: 'Comunicação',
  CRM: 'CRM',
  OTHER: 'Plataforma',
}

type KindEntry = Omit<NotificationKindInfo, 'kind' | 'moduleLabel'>

/**
 * Catálogo dos tipos conhecidos. Os do ServiceDesk espelham
 * `src/config/servicedesk-notifications.ts` (`SdNotificationEventSpec.kind`),
 * mas aqui o recorte é o que o usuário lê na caixa de entrada.
 */
const NOTIFICATION_KINDS: Record<string, KindEntry> = {
  WHATSAPP_NEGATIVE_SENTIMENT: {
    module: 'COMMUNICATION',
    label: 'Sentimento negativo',
    icon: 'chat',
    color: 'rose',
  },
  SD_TICKET_CREATED: {
    module: 'SERVICE_DESK',
    label: 'Chamado aberto',
    icon: 'ticket',
    color: 'sky',
  },
  SD_TICKET_ASSIGNED: {
    module: 'SERVICE_DESK',
    label: 'Chamado atribuído',
    icon: 'ticket',
    color: 'sky',
  },
  SD_TICKET_MESSAGE: {
    module: 'SERVICE_DESK',
    label: 'Nova mensagem',
    icon: 'message',
    color: 'indigo',
  },
  SD_TICKET_MENTIONED: {
    module: 'SERVICE_DESK',
    label: 'Menção',
    icon: 'mention',
    color: 'violet',
  },
  SD_TICKET_PHASE_CHANGED: {
    module: 'SERVICE_DESK',
    label: 'Mudança de fase',
    icon: 'ticket',
    color: 'blue',
  },
  SD_TICKET_RESOLVED: {
    module: 'SERVICE_DESK',
    label: 'Chamado resolvido',
    icon: 'ticket-check',
    color: 'emerald',
  },
  SD_TICKET_REOPENED: {
    module: 'SERVICE_DESK',
    label: 'Chamado reaberto',
    icon: 'ticket-alert',
    color: 'amber',
  },
  SD_SLA_AT_RISK: {
    module: 'SERVICE_DESK',
    label: 'SLA em risco',
    icon: 'alarm',
    color: 'amber',
  },
  SD_SLA_BREACHED: {
    module: 'SERVICE_DESK',
    label: 'SLA violado',
    icon: 'alarm',
    color: 'rose',
  },
  SD_TICKET_ESCALATED: {
    module: 'SERVICE_DESK',
    label: 'Escalonamento',
    icon: 'escalate',
    color: 'orange',
  },
  SD_APPROVAL_REQUESTED: {
    module: 'SERVICE_DESK',
    label: 'Aprovação solicitada',
    icon: 'approval',
    color: 'violet',
  },
  SD_APPROVAL_RESPONDED: {
    module: 'SERVICE_DESK',
    label: 'Aprovação respondida',
    icon: 'approval',
    color: 'emerald',
  },
  SD_TASK_ASSIGNED: {
    module: 'SERVICE_DESK',
    label: 'Tarefa atribuída',
    icon: 'task',
    color: 'teal',
  },
  SD_TICKET_CSAT: {
    module: 'SERVICE_DESK',
    label: 'Avaliação recebida',
    icon: 'star',
    color: 'yellow',
  },
  SD_DIGEST: {
    module: 'SERVICE_DESK',
    label: 'Resumo diário',
    icon: 'digest',
    color: 'slate',
  },
}

const MODULE_BY_PREFIX: [string, NotificationModule][] = [
  ['SD_', 'SERVICE_DESK'],
  ['WHATSAPP_', 'COMMUNICATION'],
  ['CRM_', 'CRM'],
]

const ICON_BY_MODULE: Record<NotificationModule, NotificationIcon> = {
  SERVICE_DESK: 'ticket',
  COMMUNICATION: 'chat',
  CRM: 'deal',
  OTHER: 'bell',
}

const COLOR_BY_MODULE: Record<NotificationModule, string> = {
  SERVICE_DESK: 'sky',
  COMMUNICATION: 'emerald',
  CRM: 'violet',
  OTHER: 'slate',
}

/** Módulo de um tipo, pela tabela ou pelo prefixo. */
export function notificationModuleOf(kind: string): NotificationModule {
  const known = NOTIFICATION_KINDS[kind]
  if (known) return known.module
  for (const [prefix, module] of MODULE_BY_PREFIX) {
    if (kind.startsWith(prefix)) return module
  }
  return 'OTHER'
}

/**
 * Rótulo de fallback para um tipo fora da tabela: `CRM_DEAL_WON` →
 * `Crm deal won`. Feio de propósito — avisa que falta entrada no catálogo
 * sem mostrar `undefined` para o usuário.
 */
function fallbackLabel(kind: string): string {
  const words = kind.toLowerCase().replace(/_/g, ' ').trim()
  if (words.length === 0) return 'Notificação'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Metadados de um tipo. Nunca falha. */
export function notificationKindInfo(kind: string): NotificationKindInfo {
  const known = NOTIFICATION_KINDS[kind]
  const module = known?.module ?? notificationModuleOf(kind)
  return {
    kind,
    module,
    moduleLabel: NOTIFICATION_MODULE_LABELS[module],
    label: known?.label ?? fallbackLabel(kind),
    icon: known?.icon ?? ICON_BY_MODULE[module],
    color: known?.color ?? COLOR_BY_MODULE[module],
  }
}

/** Todos os tipos conhecidos de um módulo (filtro por módulo da listagem). */
export function notificationKindsOfModule(module: NotificationModule): string[] {
  return Object.keys(NOTIFICATION_KINDS).filter(
    (kind) => NOTIFICATION_KINDS[kind].module === module,
  )
}

/** Catálogo para montar os filtros da interface, agrupado por módulo. */
export function notificationKindCatalog(): NotificationKindInfo[] {
  return Object.keys(NOTIFICATION_KINDS).map(notificationKindInfo)
}

/**
 * Chamado referenciado por um `href` de notificação
 * (`/<slug>/servicedesk/tickets/<numero>`), para o painel de leitura mostrar
 * um resumo do chamado sem a caixa de entrada conhecer o ServiceDesk. `null`
 * quando o link não é de chamado — e aí o painel degrada para o simples.
 */
export function notificationTicketRef(
  href: string | null | undefined,
): { slug: string; ticketRef: string } | null {
  if (!href) return null
  const match = /^\/([^/?#]+)\/servicedesk\/tickets\/([^/?#]+)/.exec(href)
  if (!match) return null
  return { slug: match[1], ticketRef: match[2] }
}
