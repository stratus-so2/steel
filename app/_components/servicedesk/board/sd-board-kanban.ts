import type { SdConfigBootstrapDTO, SdPhaseDTO } from '@/types/sd-config'
import type {
  SdPhaseCategoryDTO,
  SdTicketDTO,
  SdTicketKanbanDTO,
  SdTicketTypeDTO,
} from '@/types/sd-ticket'
import {
  SD_BOARD_CATEGORIES,
  SD_PHASE_CATEGORY_COLOR,
  SD_PHASE_CATEGORY_LABEL,
} from '../ticket/sd-ticket-meta'
import { sdTypePhases } from '../ticket/sd-ticket-options'
import type { SdSortField } from './sd-board-state'
import type { SdKanbanColumn } from './sd-kanban-view'

/**
 * Colunas do kanban de um tipo: as fases ativas da configuração, na ordem,
 * preenchidas com os cartões e contagens do quadro da API.
 */
export function sdTypeKanbanColumns(
  phases: SdPhaseDTO[],
  board: SdTicketKanbanDTO | undefined,
): SdKanbanColumn[] {
  return phases.map((phase) => {
    const column = board?.columns.find((c) => c.phase.id === phase.id)
    return {
      id: phase.id,
      name: phase.name,
      color: phase.color ?? SD_PHASE_CATEGORY_COLOR[phase.category],
      percent: phase.completionPercent,
      count: column?.count ?? 0,
      wipLimit: phase.wipLimit,
      items: column?.items ?? [],
    }
  })
}

function sortValue(ticket: SdTicketDTO, sort: SdSortField): number | string {
  switch (sort) {
    case 'number':
      return ticket.number
    case 'title':
      return ticket.title.toLocaleLowerCase('pt-BR')
    case 'priority':
      return ticket.priority?.level ?? Number.MAX_SAFE_INTEGER
    case 'resolutionDueAt':
    case 'firstResponseDueAt': {
      const due = ticket[sort]
      return due ? new Date(due).getTime() : Number.MAX_SAFE_INTEGER
    }
    default:
      return new Date(ticket[sort]).getTime()
  }
}

/** Ordena como a API ordenaria (para mesclar quadros de tipos diferentes). */
export function sdSortTickets(
  tickets: SdTicketDTO[],
  sort: SdSortField,
  order: 'asc' | 'desc',
): SdTicketDTO[] {
  const dir = order === 'asc' ? 1 : -1
  return [...tickets].sort((a, b) => {
    const x = sortValue(a, sort)
    const y = sortValue(b, sort)
    if (x < y) return -1 * dir
    if (x > y) return 1 * dir
    return a.id.localeCompare(b.id)
  })
}

function boardCategory(category: SdPhaseCategoryDTO): SdPhaseCategoryDTO {
  return category === 'CANCELED' ? 'CLOSED' : category
}

/**
 * Quadro "Todos": une os quadros por tipo em colunas por categoria de fase
 * (Novo, Em andamento, Aguardando, Resolvido, Fechado — cancelados entram
 * em Fechado), somando as contagens.
 */
export function sdMergeKanbanByCategory(
  boards: SdTicketKanbanDTO[],
  sort: SdSortField,
  order: 'asc' | 'desc',
  limit = 50,
): SdKanbanColumn[] {
  return SD_BOARD_CATEGORIES.map((category) => {
    const columns = boards.flatMap((b) =>
      b.columns.filter((c) => boardCategory(c.phase.category) === category),
    )
    const items = sdSortTickets(
      columns.flatMap((c) => c.items),
      sort,
      order,
    ).slice(0, limit)
    return {
      id: category,
      name: SD_PHASE_CATEGORY_LABEL[category],
      color: SD_PHASE_CATEGORY_COLOR[category],
      percent: null,
      count: columns.reduce((sum, c) => sum + c.count, 0),
      wipLimit: 0,
      items,
    }
  })
}

/**
 * Fase de destino ao soltar um cartão numa categoria do quadro "Todos":
 * a primeira fase ativa do tipo do chamado nessa categoria (em "Fechado",
 * prefere CLOSED a CANCELED).
 */
export function sdPhaseForCategory(
  config: Pick<SdConfigBootstrapDTO, 'phases'> | undefined,
  type: SdTicketTypeDTO,
  category: string,
): SdPhaseDTO | null {
  const phases = sdTypePhases(config, type)
  return (
    phases.find((p) => p.category === category) ??
    (category === 'CLOSED'
      ? (phases.find((p) => p.category === 'CANCELED') ?? null)
      : null)
  )
}
