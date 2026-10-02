import type {
  SdPhaseCategoryDTO,
  SdSlaStateDTO,
  SdSlaTimerDTO,
  SdSlaTimerStateDTO,
  SdTicketChannelDTO,
  SdTicketDTO,
  SdTicketTypeDTO,
} from '@/types/sd-ticket'

/**
 * Rótulos, cores e formatadores compartilhados pelas telas de chamados
 * (quadros, tela do chamado, início). Funções puras — testáveis sem DOM.
 */

/* ------------------------------------------------------------------ */
/* Tons de status                                                       */
/* ------------------------------------------------------------------ */

/**
 * O módulo tem exatamente estes tons de status. Tudo que não é status usa
 * token semântico (`muted`, `card`, `primary`, `destructive`, `border`…) —
 * cor crua da paleta não acompanha o tema e estraga o modo claro.
 */
export type SdTone =
  | 'slate'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'orange'
  | 'red'
  | 'rose'

/**
 * Fundo translúcido + texto legível nos dois temas — o padrão do
 * repositório (`app/_components/notifications/notification-kind-icon.tsx`).
 * Mapa fechado: o Tailwind só vê as classes que estão escritas aqui, então
 * nenhuma tela deve montar `bg-<cor>-500/10` por conta própria.
 */
export const SD_TONE: Record<SdTone, string> = {
  slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

/** O mesmo tom com borda — chips, faixas de aviso e cartões de estado. */
export const SD_TONE_SOFT: Record<SdTone, string> = {
  slate:
    'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  sky: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  indigo:
    'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  violet:
    'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  teal: 'border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  emerald:
    'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber:
    'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange:
    'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  red: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  rose: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

/** Só a cor do texto ou do ícone, sobre superfície lisa. */
export const SD_TONE_TEXT: Record<SdTone, string> = {
  slate: 'text-slate-700 dark:text-slate-300',
  sky: 'text-sky-700 dark:text-sky-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
  violet: 'text-violet-700 dark:text-violet-300',
  teal: 'text-teal-700 dark:text-teal-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  orange: 'text-orange-700 dark:text-orange-300',
  red: 'text-red-700 dark:text-red-300',
  rose: 'text-rose-700 dark:text-rose-300',
}

/** Preenchimento sólido — barras de progresso e pontos de legenda. */
export const SD_TONE_FILL: Record<SdTone, string> = {
  slate: 'bg-slate-500',
  sky: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  rose: 'bg-rose-500',
}

export const SD_TICKET_TYPES: SdTicketTypeDTO[] = [
  'INCIDENT',
  'SERVICE_REQUEST',
  'CHANGE',
  'PROBLEM',
]

export const SD_TICKET_TYPE_LABEL: Record<SdTicketTypeDTO, string> = {
  INCIDENT: 'Incidente',
  SERVICE_REQUEST: 'Requisição',
  CHANGE: 'Mudança',
  PROBLEM: 'Problema',
}

export const SD_TICKET_TYPE_PLURAL: Record<SdTicketTypeDTO, string> = {
  INCIDENT: 'Incidentes',
  SERVICE_REQUEST: 'Requisições',
  CHANGE: 'Mudanças',
  PROBLEM: 'Problemas',
}

/** Cor de destaque de cada tipo (badges e cartões). */
export const SD_TICKET_TYPE_TONE: Record<SdTicketTypeDTO, string> = {
  INCIDENT: SD_TONE_SOFT.red,
  SERVICE_REQUEST: SD_TONE_SOFT.sky,
  CHANGE: SD_TONE_SOFT.violet,
  PROBLEM: SD_TONE_SOFT.amber,
}

/** Segmento da URL de cada quadro por tipo. */
export const SD_TYPE_ROUTE: Record<SdTicketTypeDTO, string> = {
  INCIDENT: 'incidents',
  SERVICE_REQUEST: 'requests',
  CHANGE: 'changes',
  PROBLEM: 'problems',
}

export const SD_PHASE_CATEGORY_LABEL: Record<SdPhaseCategoryDTO, string> = {
  NEW: 'Novo',
  IN_PROGRESS: 'Em andamento',
  WAITING: 'Aguardando',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELED: 'Cancelado',
}

/** Colunas do kanban "Todos" (cancelados entram em "Fechado"). */
export const SD_BOARD_CATEGORIES: SdPhaseCategoryDTO[] = [
  'NEW',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
]

export const SD_PHASE_CATEGORY_COLOR: Record<SdPhaseCategoryDTO, string> = {
  NEW: '#0ea5e9',
  IN_PROGRESS: '#6366f1',
  WAITING: '#f59e0b',
  RESOLVED: '#10b981',
  CLOSED: '#64748b',
  CANCELED: '#94a3b8',
}

export const SD_CLOSED_CATEGORIES: SdPhaseCategoryDTO[] = [
  'RESOLVED',
  'CLOSED',
  'CANCELED',
]

export const SD_CHANNEL_LABEL: Record<SdTicketChannelDTO, string> = {
  AGENT: 'Agente',
  PORTAL: 'Portal',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  PHONE: 'Telefone',
  AI: 'IA',
  API: 'API',
}

export const SD_CHANGE_TYPE_LABEL = {
  STANDARD: 'Padrão',
  NORMAL: 'Normal',
  EMERGENCY: 'Emergencial',
} as const

export const SD_RISK_LABEL = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  VERY_HIGH: 'Muito alto',
} as const

export const SD_SLA_STATE_LABEL: Record<SdSlaTimerStateDTO, string> = {
  ok: 'No prazo',
  at_risk: 'Em risco',
  breached: 'Violado',
  met: 'Cumprido',
  paused: 'Pausado',
  none: 'Sem SLA',
}

export const SD_SLA_STATE_TONE: Record<SdSlaTimerStateDTO, string> = {
  ok: SD_TONE_SOFT.emerald,
  at_risk: SD_TONE_SOFT.amber,
  breached: SD_TONE_SOFT.red,
  met: 'border-border bg-muted text-muted-foreground',
  paused: SD_TONE_SOFT.slate,
  none: 'border-border bg-muted text-muted-foreground',
}

/** Preenchimento da barra de consumo do SLA (widget do cabeçalho). */
export const SD_SLA_STATE_BAR: Record<SdSlaTimerStateDTO, string> = {
  ok: SD_TONE_FILL.emerald,
  at_risk: SD_TONE_FILL.amber,
  breached: SD_TONE_FILL.red,
  met: 'bg-muted-foreground/50',
  paused: SD_TONE_FILL.slate,
  none: 'bg-muted-foreground/30',
}

/** Rótulos dos campos do chamado (rastreabilidade, campos obrigatórios). */
export const SD_TICKET_FIELD_LABEL: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  channel: 'Canal',
  phaseId: 'Fase',
  type: 'Tipo',
  impactId: 'Impacto',
  urgencyId: 'Urgência',
  priorityId: 'Prioridade',
  severityId: 'Severidade',
  categoryId: 'Categoria',
  subcategoryId: 'Subcategoria',
  serviceId: 'Serviço',
  classificationId: 'Classificação',
  solutionClassificationId: 'Classificação da solução',
  solution: 'Solução',
  customerId: 'Cliente',
  companyId: 'Empresa',
  contactId: 'Contato',
  configItemId: 'Item de configuração',
  departmentId: 'Departamento',
  assigneeId: 'Responsável',
  requesterId: 'Solicitante',
  parentId: 'Item pai',
  participants: 'Participantes',
  tags: 'Tags',
  changeType: 'Tipo de mudança',
  changeRisk: 'Risco',
  plannedStartAt: 'Início planejado',
  plannedEndAt: 'Fim planejado',
  implementationPlan: 'Plano de implantação',
  rollbackPlan: 'Plano de retorno',
  testPlan: 'Plano de testes',
  rootCause: 'Causa raiz',
  workaround: 'Solução de contorno',
  knownError: 'Erro conhecido',
  escalationLevel: 'Nível de escalonamento',
  csatScore: 'Satisfação',
  csatComment: 'Comentário da satisfação',
  customFields: 'Campos customizados',
}

export function sdFieldLabel(field: string): string {
  if (field.startsWith('customFields.')) return field.slice(13)
  return SD_TICKET_FIELD_LABEL[field] ?? field
}

/* ------------------------------------------------------------------ */
/* Tempo                                                                */
/* ------------------------------------------------------------------ */

/** Duração compacta: `45 min`, `3 h 20 min`, `2 d 4 h`. */
export function sdFormatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(Math.abs(totalMinutes)))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours > 0 ? `${days} d ${restHours} h` : `${days} d`
}

/** "há 5 min", "em 2 h", "agora". */
export function sdRelativeTime(
  iso: string | Date,
  now: Date = new Date(),
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const diff = Math.round((date.getTime() - now.getTime()) / 60_000)
  if (Math.abs(diff) < 1) return 'agora'
  const label = sdFormatDuration(diff)
  return diff > 0 ? `em ${label}` : `há ${label}`
}

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const DATE_ONLY = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function sdFormatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME.format(date)
}

export function sdFormatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : DATE_ONLY.format(date)
}

/** `datetime-local` ⇄ ISO (fuso do navegador). */
export function sdToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function sdFromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/* ------------------------------------------------------------------ */
/* SLA                                                                  */
/* ------------------------------------------------------------------ */

export interface SdLiveSla {
  state: SdSlaTimerStateDTO
  /** Minutos corridos até o prazo (negativo = atrasado); `null` sem prazo. */
  remaining: number | null
  dueAt: string | null
  percentUsed: number | null
}

/**
 * Estado "ao vivo" de um relógio: o servidor calcula no momento da
 * resposta; aqui o prazo corre no relógio do navegador (um prazo vencido
 * vira "Violado" sem esperar o próximo recarregamento).
 */
export function sdLiveSla(
  timer: SdSlaTimerDTO,
  now: Date = new Date(),
): SdLiveSla {
  const base = {
    dueAt: timer.dueAt,
    percentUsed: timer.percentUsed,
  }
  if (!timer.dueAt || timer.state === 'none') {
    return { ...base, state: timer.state, remaining: null }
  }
  if (timer.state === 'met' || timer.state === 'paused') {
    return { ...base, state: timer.state, remaining: timer.remainingMinutes }
  }
  const remaining = Math.floor(
    (new Date(timer.dueAt).getTime() - now.getTime()) / 60_000,
  )
  const state: SdSlaTimerStateDTO = remaining < 0 ? 'breached' : timer.state
  return { ...base, state, remaining }
}

const SLA_URGENCY: Record<SdSlaTimerStateDTO, number> = {
  breached: 0,
  at_risk: 1,
  ok: 2,
  paused: 3,
  met: 4,
  none: 5,
}

/**
 * O relógio que importa agora: a 1ª resposta enquanto pendente, senão a
 * resolução — o mais urgente dos dois (violado > em risco > no prazo).
 */
export function sdPrimarySla(
  sla: SdSlaStateDTO,
  now: Date = new Date(),
): { kind: 'firstResponse' | 'resolution'; live: SdLiveSla } {
  const first = sdLiveSla(sla.firstResponse, now)
  const resolution = sdLiveSla(sla.resolution, now)
  const firstPending = first.state !== 'met' && first.state !== 'none'
  if (!firstPending) return { kind: 'resolution', live: resolution }
  if (SLA_URGENCY[first.state] < SLA_URGENCY[resolution.state]) {
    return { kind: 'firstResponse', live: first }
  }
  if (SLA_URGENCY[resolution.state] < SLA_URGENCY[first.state]) {
    return { kind: 'resolution', live: resolution }
  }
  return (first.remaining ?? Number.POSITIVE_INFINITY) <=
    (resolution.remaining ?? Number.POSITIVE_INFINITY)
    ? { kind: 'firstResponse', live: first }
    : { kind: 'resolution', live: resolution }
}

/** Texto curto do relógio: "2 h 10 min", "atrasado 15 min", "pausado". */
export function sdSlaShortText(live: SdLiveSla): string {
  if (live.state === 'none') return 'Sem SLA'
  if (live.state === 'paused') return 'Pausado'
  if (live.state === 'met') return 'Cumprido'
  if (live.remaining === null) return SD_SLA_STATE_LABEL[live.state]
  if (live.remaining < 0) return `Atrasado ${sdFormatDuration(live.remaining)}`
  return sdFormatDuration(live.remaining)
}

/** Ordenação por urgência de SLA (minha fila). */
export function sdSlaSortKey(ticket: SdTicketDTO, now = new Date()): number {
  const { live } = sdPrimarySla(ticket.sla, now)
  const bucket = SLA_URGENCY[live.state] * 1e9
  return bucket + (live.remaining ?? 5e8)
}

/* ------------------------------------------------------------------ */
/* Diversos                                                             */
/* ------------------------------------------------------------------ */

export function sdTicketHref(
  slug: string,
  ticket: Pick<SdTicketDTO, 'number'>,
  tab?: string,
): string {
  const url = `/${slug}/servicedesk/tickets/${ticket.number}`
  return tab ? `${url}?tab=${tab}` : url
}

export function sdInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return `${first}${last}`.toUpperCase() || '?'
}

/** Cor legível para um fundo hex (`#rrggbb`) — texto branco ou escuro. */
export function sdReadableOn(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return 'inherit'
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1f2937' : '#ffffff'
}

/** Idade do chamado em texto curto ("3 d"). */
export function sdTicketAge(createdAt: string, now = new Date()): string {
  const minutes = (now.getTime() - new Date(createdAt).getTime()) / 60_000
  return sdFormatDuration(minutes)
}
