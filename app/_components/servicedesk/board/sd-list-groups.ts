import type { SdTicketDTO } from '@/types/sd-ticket'
import {
  SD_BOARD_CATEGORIES,
  SD_PHASE_CATEGORY_COLOR,
  SD_SLA_STATE_LABEL,
  SD_TICKET_TYPE_LABEL,
  sdPrimarySla,
} from '../ticket/sd-ticket-meta'
import type { SdListGroup } from './sd-board-state'

export interface SdTicketGroup {
  key: string
  label: string
  color: string | null
  items: SdTicketDTO[]
}

export const SD_LIST_GROUP_LABEL: Record<SdListGroup, string> = {
  phase: 'Fase',
  priority: 'Prioridade',
  assignee: 'Responsável',
  department: 'Departamento',
  sla: 'Estado do SLA',
}

const SLA_ORDER = ['breached', 'at_risk', 'ok', 'paused', 'met', 'none']
const SLA_COLOR: Record<string, string> = {
  breached: '#ef4444',
  at_risk: '#f59e0b',
  ok: '#10b981',
  paused: '#94a3b8',
  met: '#64748b',
  none: '#cbd5e1',
}

interface Bucket extends SdTicketGroup {
  order: number
}

/**
 * Agrupa chamados para a visão "Lista". A ordem dos grupos segue o
 * sentido do campo (fluxo das fases, nível da prioridade, urgência do SLA);
 * "sem valor" vai para o fim (exceto "Não atribuído", que vem primeiro).
 */
export function sdGroupTickets(
  tickets: SdTicketDTO[],
  group: SdListGroup,
  now: Date = new Date(),
): SdTicketGroup[] {
  const buckets = new Map<string, Bucket>()
  const mixedTypes = new Set(tickets.map((t) => t.type)).size > 1

  function add(ticket: SdTicketDTO, bucket: Omit<Bucket, 'items'>) {
    const existing = buckets.get(bucket.key)
    if (existing) existing.items.push(ticket)
    else buckets.set(bucket.key, { ...bucket, items: [ticket] })
  }

  for (const t of tickets) {
    switch (group) {
      case 'phase': {
        const categoryIndex = Math.max(
          0,
          SD_BOARD_CATEGORIES.indexOf(
            t.phase.category === 'CANCELED' ? 'CLOSED' : t.phase.category,
          ),
        )
        add(t, {
          key: t.phase.id,
          label: mixedTypes
            ? `${t.phase.name} · ${SD_TICKET_TYPE_LABEL[t.type]}`
            : t.phase.name,
          color: t.phase.color ?? SD_PHASE_CATEGORY_COLOR[t.phase.category],
          order: categoryIndex * 1000 + t.phase.position,
        })
        break
      }
      case 'priority':
        add(
          t,
          t.priority
            ? {
                key: t.priority.id,
                label: t.priority.name,
                color: t.priority.color,
                order: t.priority.level,
              }
            : {
                key: 'none',
                label: 'Sem prioridade',
                color: null,
                order: Number.MAX_SAFE_INTEGER,
              },
        )
        break
      case 'assignee':
        add(
          t,
          t.assignee
            ? {
                key: t.assignee.id,
                label: t.assignee.name,
                color: null,
                order: 1,
              }
            : { key: 'none', label: 'Não atribuído', color: null, order: 0 },
        )
        break
      case 'department':
        add(
          t,
          t.department
            ? {
                key: t.department.id,
                label: t.department.name,
                color: t.department.color ?? null,
                order: 0,
              }
            : {
                key: 'none',
                label: 'Sem departamento',
                color: null,
                order: 1,
              },
        )
        break
      case 'sla': {
        const state = sdPrimarySla(t.sla, now).live.state
        add(t, {
          key: state,
          label: SD_SLA_STATE_LABEL[state],
          color: SLA_COLOR[state],
          order: SLA_ORDER.indexOf(state),
        })
        break
      }
    }
  }

  return [...buckets.values()]
    .sort(
      (a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'),
    )
    .map(({ order: _order, ...rest }) => rest)
}
