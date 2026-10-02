import type { SdTicketFilters } from '@/src/hooks/use-sd-tickets'
import type { SdSavedViewDTO, SdTicketTypeDTO } from '@/types/sd-ticket'

/**
 * Estado dos quadros de chamados (modo, filtros, ordenação, página,
 * agrupamento, visão salva) serializado na URL — o link é compartilhável e
 * o "voltar" do navegador desfaz filtros. Funções puras.
 */

export type SdBoardMode = 'kanban' | 'list' | 'table'
export type SdListGroup =
  | 'phase'
  | 'priority'
  | 'assignee'
  | 'department'
  | 'sla'
export type SdSortField = NonNullable<SdTicketFilters['sort']>

/** Filtros do quadro (mesmas chaves da API; datas em `AAAA-MM-DD`). */
export interface SdBoardFilters {
  q?: string
  types?: SdTicketTypeDTO[]
  phaseIds?: string[]
  priorityIds?: string[]
  severityIds?: string[]
  impactIds?: string[]
  urgencyIds?: string[]
  departmentIds?: string[]
  assigneeIds?: string[]
  tags?: string[]
  requesterId?: string
  participantId?: string
  customerId?: string
  companyId?: string
  contactId?: string
  configItemId?: string
  categoryId?: string
  subcategoryId?: string
  serviceId?: string
  classificationId?: string
  channel?: SdTicketFilters['channel']
  sla?: 'at_risk' | 'breached'
  /** Faixa da previsão de risco (`servicedesk-risk`). */
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  createdFrom?: string
  createdTo?: string
  dueFrom?: string
  dueTo?: string
  includeClosed?: boolean
}

export interface SdBoardState {
  mode: SdBoardMode
  filters: SdBoardFilters
  sort: SdSortField
  order: 'asc' | 'desc'
  page: number
  pageSize: number
  group: SdListGroup
  /** Visão salva aplicada. */
  viewId: string | null
  /** Quadro "Todos": tipo escolhido no seletor (`null` = todos). */
  type: SdTicketTypeDTO | null
}

export const SD_ARRAY_FILTER_KEYS = [
  'types',
  'phaseIds',
  'priorityIds',
  'severityIds',
  'impactIds',
  'urgencyIds',
  'departmentIds',
  'assigneeIds',
  'tags',
] as const

export const SD_SCALAR_FILTER_KEYS = [
  'requesterId',
  'participantId',
  'customerId',
  'companyId',
  'contactId',
  'configItemId',
  'categoryId',
  'subcategoryId',
  'serviceId',
  'classificationId',
  'channel',
  'sla',
  'riskLevel',
  'createdFrom',
  'createdTo',
  'dueFrom',
  'dueTo',
] as const

const MODES: SdBoardMode[] = ['kanban', 'list', 'table']
const GROUPS: SdListGroup[] = [
  'phase',
  'priority',
  'assignee',
  'department',
  'sla',
]
export const SD_SORT_FIELDS: SdSortField[] = [
  'createdAt',
  'updatedAt',
  'lastActivityAt',
  'number',
  'title',
  'priority',
  'resolutionDueAt',
  'firstResponseDueAt',
]

/** Rótulo de cada campo de ordenação — popover "Ordenar" e chip ativo. */
export const SD_SORT_FIELD_LABEL: Record<SdSortField, string> = {
  createdAt: 'Aberto em',
  updatedAt: 'Atualizado em',
  lastActivityAt: 'Última atividade',
  number: 'Código',
  title: 'Título',
  priority: 'Prioridade',
  resolutionDueAt: 'Prazo de resolução',
  firstResponseDueAt: 'Prazo da 1ª resposta',
}
const TYPES: SdTicketTypeDTO[] = [
  'INCIDENT',
  'SERVICE_REQUEST',
  'CHANGE',
  'PROBLEM',
]

export const SD_BOARD_DEFAULTS: SdBoardState = {
  mode: 'kanban',
  filters: {},
  sort: 'createdAt',
  order: 'desc',
  page: 1,
  pageSize: 25,
  group: 'phase',
  viewId: null,
  type: null,
}

function csv(value: string | null): string[] | undefined {
  if (!value) return undefined
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function positive(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : fallback
}

/** Só as chaves conhecidas, sem vazios (URL e visões salvas). */
export function sdNormalizeFilters(
  input: Record<string, unknown>,
): SdBoardFilters {
  const out: Record<string, unknown> = {}
  for (const key of SD_ARRAY_FILTER_KEYS) {
    const raw = input[key]
    const list = Array.isArray(raw)
      ? raw.map(String).filter(Boolean)
      : typeof raw === 'string'
        ? csv(raw)
        : undefined
    if (list && list.length > 0) out[key] = list
  }
  for (const key of SD_SCALAR_FILTER_KEYS) {
    const raw = input[key]
    if (typeof raw === 'string' && raw.trim() !== '') out[key] = raw.trim()
  }
  if (typeof input.q === 'string' && input.q.trim() !== '') {
    out.q = input.q.trim()
  }
  if (input.includeClosed === true || input.includeClosed === 'true') {
    out.includeClosed = true
  }
  if (Array.isArray(out.types)) {
    out.types = (out.types as string[]).filter((t) =>
      (TYPES as string[]).includes(t),
    )
    if ((out.types as string[]).length === 0) delete out.types
  }
  return out as SdBoardFilters
}

export function sdParseBoardState(
  params: URLSearchParams,
  defaults: Partial<SdBoardState> = {},
): SdBoardState {
  const base = { ...SD_BOARD_DEFAULTS, ...defaults }
  const raw: Record<string, unknown> = {}
  params.forEach((value, key) => {
    raw[key] = value
  })
  return {
    mode: oneOf(params.get('mode'), MODES, base.mode),
    filters: sdNormalizeFilters(raw),
    sort: oneOf(params.get('sort'), SD_SORT_FIELDS, base.sort),
    order: oneOf(params.get('order'), ['asc', 'desc'] as const, base.order),
    page: positive(params.get('page'), 1, 10_000),
    pageSize: positive(params.get('pageSize'), base.pageSize, 200),
    group: oneOf(params.get('group'), GROUPS, base.group),
    viewId: params.get('view') || null,
    type: (TYPES as string[]).includes(params.get('type') ?? '')
      ? (params.get('type') as SdTicketTypeDTO)
      : null,
  }
}

/** URL do estado (omite os valores padrão). */
export function sdSerializeBoardState(
  state: SdBoardState,
  defaults: Partial<SdBoardState> = {},
): string {
  const base = { ...SD_BOARD_DEFAULTS, ...defaults }
  const params = new URLSearchParams()
  if (state.mode !== base.mode) params.set('mode', state.mode)
  if (state.viewId) params.set('view', state.viewId)
  if (state.type) params.set('type', state.type)
  const filters = sdNormalizeFilters(state.filters as Record<string, unknown>)
  if (filters.q) params.set('q', filters.q)
  for (const key of SD_ARRAY_FILTER_KEYS) {
    const value = filters[key]
    if (value?.length) params.set(key, value.join(','))
  }
  for (const key of SD_SCALAR_FILTER_KEYS) {
    const value = filters[key]
    if (value) params.set(key, value)
  }
  if (filters.includeClosed) params.set('includeClosed', 'true')
  if (state.sort !== base.sort) params.set('sort', state.sort)
  if (state.order !== base.order) params.set('order', state.order)
  if (state.page > 1) params.set('page', String(state.page))
  if (state.pageSize !== base.pageSize) {
    params.set('pageSize', String(state.pageSize))
  }
  if (state.group !== base.group) params.set('group', state.group)
  return params.toString()
}

/** Filtros ativos (sem a busca) — contador do botão e "limpar tudo". */
export function sdActiveFilterCount(filters: SdBoardFilters): number {
  const normalized = sdNormalizeFilters(filters as Record<string, unknown>)
  return Object.keys(normalized).filter((key) => key !== 'q').length
}

/** `AAAA-MM-DD` de hoje no fuso do navegador. */
export function sdTodayLocal(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Data `AAAA-MM-DD` → ISO do início (ou fim) do dia local. */
export function sdDayBoundary(value: string, end: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [y, m, d] = value.split('-').map(Number)
  const date = end
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0)
  return date.toISOString()
}

/** Estado do quadro → filtros da API (tipo fixo do quadro prevalece). */
export function sdBoardApiFilters(
  state: Pick<SdBoardState, 'filters' | 'sort' | 'order' | 'type'>,
  fixedType: SdTicketTypeDTO | null,
): SdTicketFilters {
  const f = sdNormalizeFilters(state.filters as Record<string, unknown>)
  const type = fixedType ?? state.type
  const out: SdTicketFilters = {
    ...f,
    types: type ? undefined : f.types,
    type: type ?? undefined,
    createdFrom: f.createdFrom
      ? sdDayBoundary(f.createdFrom, false)
      : undefined,
    createdTo: f.createdTo ? sdDayBoundary(f.createdTo, true) : undefined,
    dueFrom: f.dueFrom ? sdDayBoundary(f.dueFrom, false) : undefined,
    dueTo: f.dueTo ? sdDayBoundary(f.dueTo, true) : undefined,
    sort: state.sort,
    order: state.order,
  }
  for (const key of Object.keys(out) as (keyof SdTicketFilters)[]) {
    if (out[key] === undefined) delete out[key]
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Filtros rápidos                                                      */
/* ------------------------------------------------------------------ */

export type SdQuickFilterId =
  | 'mine'
  | 'unassigned'
  | 'at_risk'
  | 'breached'
  | 'risk_high'
  | 'today'
  | 'participating'

export const SD_QUICK_FILTERS: { id: SdQuickFilterId; label: string }[] = [
  { id: 'mine', label: 'Meus chamados' },
  { id: 'unassigned', label: 'Não atribuídos' },
  { id: 'at_risk', label: 'SLA em risco' },
  { id: 'breached', label: 'SLA violado' },
  { id: 'risk_high', label: 'Risco alto' },
  { id: 'today', label: 'Abertos hoje' },
  { id: 'participating', label: 'Participo' },
]

export function sdQuickFilterActive(
  id: SdQuickFilterId,
  filters: SdBoardFilters,
  now = new Date(),
): boolean {
  switch (id) {
    case 'mine':
      return (
        filters.assigneeIds?.length === 1 && filters.assigneeIds[0] === 'me'
      )
    case 'unassigned':
      return (
        filters.assigneeIds?.length === 1 &&
        filters.assigneeIds[0] === 'unassigned'
      )
    case 'at_risk':
      return filters.sla === 'at_risk'
    case 'breached':
      return filters.sla === 'breached'
    case 'risk_high':
      return filters.riskLevel === 'HIGH'
    case 'today':
      return filters.createdFrom === sdTodayLocal(now) && !filters.createdTo
    case 'participating':
      return filters.participantId === 'me'
  }
}

/** Liga/desliga um filtro rápido (os de responsável e SLA são exclusivos). */
export function sdToggleQuickFilter(
  id: SdQuickFilterId,
  filters: SdBoardFilters,
  now = new Date(),
): SdBoardFilters {
  const active = sdQuickFilterActive(id, filters, now)
  const next = { ...filters }
  switch (id) {
    case 'mine':
      next.assigneeIds = active ? undefined : ['me']
      break
    case 'unassigned':
      next.assigneeIds = active ? undefined : ['unassigned']
      break
    case 'at_risk':
      next.sla = active ? undefined : 'at_risk'
      break
    case 'breached':
      next.sla = active ? undefined : 'breached'
      break
    case 'risk_high':
      next.riskLevel = active ? undefined : 'HIGH'
      break
    case 'today':
      next.createdFrom = active ? undefined : sdTodayLocal(now)
      next.createdTo = undefined
      break
    case 'participating':
      next.participantId = active ? undefined : 'me'
      break
  }
  return sdNormalizeFilters(next as Record<string, unknown>)
}

/* ------------------------------------------------------------------ */
/* Visões salvas                                                        */
/* ------------------------------------------------------------------ */

const VIEW_MODE: Record<SdSavedViewDTO['mode'], SdBoardMode> = {
  KANBAN: 'kanban',
  LIST: 'list',
  TABLE: 'table',
}

/** Visão salva → estado do quadro. */
export function sdStateFromView(
  view: SdSavedViewDTO,
  current: SdBoardState,
): SdBoardState {
  const sort = view.sort[0]
  return {
    ...current,
    mode: VIEW_MODE[view.mode],
    filters: sdNormalizeFilters(view.filters),
    sort:
      sort && (SD_SORT_FIELDS as string[]).includes(sort.field)
        ? (sort.field as SdSortField)
        : SD_BOARD_DEFAULTS.sort,
    order: sort?.order ?? SD_BOARD_DEFAULTS.order,
    page: 1,
    viewId: view.id,
  }
}

/** Estado do quadro → corpo de uma visão salva. */
export function sdViewPayload(state: SdBoardState) {
  return {
    mode: state.mode.toUpperCase() as SdSavedViewDTO['mode'],
    filters: sdNormalizeFilters(
      state.filters as Record<string, unknown>,
    ) as Record<string, unknown>,
    sort: [{ field: state.sort, order: state.order }],
  }
}

/** A visão aplicada foi alterada (filtros/modo/ordem diferentes)? */
export function sdViewDirty(
  view: SdSavedViewDTO,
  state: SdBoardState,
): boolean {
  const saved = sdStateFromView(view, state)
  return (
    saved.mode !== state.mode ||
    saved.sort !== state.sort ||
    saved.order !== state.order ||
    JSON.stringify(
      sdNormalizeFilters(saved.filters as Record<string, unknown>),
    ) !==
      JSON.stringify(
        sdNormalizeFilters(state.filters as Record<string, unknown>),
      )
  )
}
