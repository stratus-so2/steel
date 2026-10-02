import type { SdTicketRiskPrediction } from '@prisma/client'
import { sdRiskFactorSpec } from '@/src/lib/servicedesk/risk'
import {
  DEFAULT_SD_TICKET_PREFIXES,
  formatSdTicketCode,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import type {
  SdClusterTicketRow,
  SdIncidentClusterWithActor,
} from '@/src/repositories/sd-risk.repository'
import type {
  SdClusterProblemRefDTO,
  SdClusterTicketRefDTO,
  SdIncidentClusterDTO,
  SdRiskFactorDTO,
  SdTicketRiskDTO,
} from '@/types/sd-risk'

/**
 * `SdTicketRiskPrediction` / `SdIncidentCluster` → DTO. Os fatores vêm de um
 * `Json`: só passam os que têm chave conhecida no catálogo
 * (`src/lib/servicedesk/risk.ts`) e frase de explicação — selo sem motivo é
 * bug (ADR 0016), então um fator sem `detail` é descartado na borda.
 */

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null)

export function toSdRiskFactorsDTO(value: unknown): SdRiskFactorDTO[] {
  if (!Array.isArray(value)) return []
  const out: SdRiskFactorDTO[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    if (typeof raw.key !== 'string') continue
    const spec = sdRiskFactorSpec(raw.key)
    if (!spec) continue
    const detail = typeof raw.detail === 'string' ? raw.detail.trim() : ''
    if (detail === '') continue
    const weight = typeof raw.weight === 'number' ? Math.round(raw.weight) : 0
    out.push({
      key: spec.key,
      label: typeof raw.label === 'string' ? raw.label : spec.label,
      weight: Math.min(Math.max(weight, 0), spec.weight),
      detail,
    })
  }
  return out.sort((a, b) => b.weight - a.weight)
}

export function toSdTicketRiskDTO(
  row: SdTicketRiskPrediction | null | undefined,
): SdTicketRiskDTO | null {
  if (!row) return null
  return {
    level: row.level,
    score: row.score,
    factors: toSdRiskFactorsDTO(row.factors),
    breachEtaAt: iso(row.breachEtaAt),
    computedAt: row.computedAt.toISOString(),
  }
}

function ticketRef(
  row: SdClusterTicketRow,
  prefixes: SdTicketPrefixes,
): SdClusterTicketRefDTO {
  return {
    id: row.id,
    number: row.number,
    code: formatSdTicketCode(row.type, row.number, prefixes),
    title: row.title,
    phase: {
      name: row.phase.name,
      color: row.phase.color,
      category: row.phase.category,
    },
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
  }
}

function problemRef(
  row: SdClusterTicketRow,
  prefixes: SdTicketPrefixes,
): SdClusterProblemRefDTO {
  return {
    id: row.id,
    number: row.number,
    code: formatSdTicketCode(row.type, row.number, prefixes),
    title: row.title,
    type: row.type,
  }
}

export interface SdClusterMapperContext {
  prefixes?: SdTicketPrefixes
  /** Chamados do grupo (incidentes e, se houver, o problema aberto). */
  tickets?: SdClusterTicketRow[]
}

export function toSdIncidentClusterDTO(
  row: SdIncidentClusterWithActor,
  ctx: SdClusterMapperContext = {},
): SdIncidentClusterDTO {
  const prefixes = ctx.prefixes ?? DEFAULT_SD_TICKET_PREFIXES
  const byId = new Map((ctx.tickets ?? []).map((t) => [t.id, t]))
  const problem = row.problemTicketId
    ? (byId.get(row.problemTicketId) ?? null)
    : null
  return {
    id: row.id,
    signature: row.signature,
    title: row.title,
    ticketCount: row.ticketCount,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    tickets: row.ticketIds
      .map((id) => byId.get(id))
      .filter((t): t is SdClusterTicketRow => t !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((t) => ticketRef(t, prefixes)),
    problemTicket: problem ? problemRef(problem, prefixes) : null,
    dismissedAt: iso(row.dismissedAt),
    dismissedBy: row.dismissedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
