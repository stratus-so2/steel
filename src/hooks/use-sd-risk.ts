import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SdIncidentClusterDTO,
  SdRiskLevelDTO,
  SdTicketRiskDTO,
} from '@/types/sd-risk'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { apiFetch } from './_fetch'

/**
 * Risco preditivo do ServiceDesk (`.../servicedesk/risk/**`): a fila por
 * risco, a previsão de um chamado e as sugestões de problema. A nota vem
 * pronta do worker — a tela nunca calcula (ADR 0016).
 */

export interface SdRiskTicketsQuery {
  level?: SdRiskLevelDTO
  minScore?: number
  departmentId?: string
  assigneeId?: string
  limit?: number
}

export interface SdClustersQuery {
  status?: 'open' | 'handled' | 'all'
  limit?: number
}

export interface OpenSdClusterProblemInput {
  title?: string
  departmentId?: string
  assigneeId?: string
  priorityId?: string
  categoryId?: string
  /** Vincula os incidentes como filhos do problema (padrão: vincula). */
  linkIncidents?: boolean
}

export const sdRiskKeys = {
  all: (ws: string) => ['sd-risk', ws] as const,
  tickets: (ws: string, query: SdRiskTicketsQuery) =>
    ['sd-risk', ws, 'tickets', query] as const,
  ticket: (ws: string, ref: string) => ['sd-risk', ws, 'ticket', ref] as const,
  clusters: (ws: string, query: SdClustersQuery) =>
    ['sd-risk', ws, 'clusters', query] as const,
}

const base = (ws: string) => `/api/workspaces/${ws}/servicedesk/risk`

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function queryString(query: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Fila por risco (padrão: faixa alta, nota maior primeiro). */
export function useSdRiskTickets(
  workspaceId: string,
  query: SdRiskTicketsQuery = {},
) {
  return useQuery({
    queryKey: sdRiskKeys.tickets(workspaceId, query),
    queryFn: () =>
      apiFetch<SdTicketDTO[]>(
        `${base(workspaceId)}/tickets${queryString(query)}`,
        undefined,
        'Erro ao carregar a fila por risco',
      ),
    enabled: Boolean(workspaceId),
    staleTime: 30 * 1000,
  })
}

/**
 * Previsão de um chamado (id, número ou código). Chamado sem previsão
 * responde 404 — a tela trata como "sem risco calculado ainda".
 */
export function useSdTicketRisk(
  workspaceId: string,
  ticketRef: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdRiskKeys.ticket(workspaceId, ticketRef ?? ''),
    queryFn: () =>
      apiFetch<SdTicketRiskDTO>(
        `${base(workspaceId)}/tickets/${encodeURIComponent(ticketRef as string)}`,
        undefined,
        'Erro ao carregar o risco do chamado',
      ),
    enabled: Boolean(workspaceId && ticketRef) && options.enabled !== false,
    retry: false,
    staleTime: 60 * 1000,
  })
}

/** Sugestões de problema (grupos de incidentes repetidos). */
export function useSdIncidentClusters(
  workspaceId: string,
  query: SdClustersQuery = {},
) {
  return useQuery({
    queryKey: sdRiskKeys.clusters(workspaceId, query),
    queryFn: () =>
      apiFetch<SdIncidentClusterDTO[]>(
        `${base(workspaceId)}/clusters${queryString(query)}`,
        undefined,
        'Erro ao carregar os agrupamentos',
      ),
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000,
  })
}

/** Abre o problema a partir do grupo (ação humana — ADR 0016). */
export function useOpenSdClusterProblem(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      clusterId,
      ...input
    }: OpenSdClusterProblemInput & { clusterId: string }) =>
      apiFetch<SdIncidentClusterDTO>(
        `${base(workspaceId)}/clusters/${clusterId}/problem`,
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(input),
        },
        'Erro ao abrir o problema',
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sdRiskKeys.all(workspaceId) })
      void qc.invalidateQueries({ queryKey: ['sd-tickets', workspaceId] })
    },
  })
}

export function useDismissSdIncidentCluster(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clusterId: string) =>
      apiFetch<SdIncidentClusterDTO>(
        `${base(workspaceId)}/clusters/${clusterId}/dismiss`,
        { method: 'POST', headers: JSON_HEADERS },
        'Erro ao descartar o agrupamento',
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sdRiskKeys.all(workspaceId) }),
  })
}
