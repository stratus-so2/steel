import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SdSeedSummary } from '@/src/repositories/sd-seed.repository'
import type { UpdateSdSettingsDTO } from '@/src/schemas/sd-settings.schema'
import type {
  SdAgentDTO,
  SdConfigBootstrapDTO,
  SdDepartmentDTO,
  SdMeDTO,
  SdPhaseTransitionDTO,
  SdPriorityMatrixCellDTO,
  SdSettingsDTO,
  SdTicketTypeDTO,
} from '@/types/sd-config'
import { apiFetch, apiSend } from './_fetch'

/**
 * Hooks da configuração do ServiceDesk. Toda chave começa com
 * `['sd-config', workspaceId]`: qualquer mutação invalida o prefixo, então
 * o bootstrap (`useSdConfig`) e as listas se atualizam juntos.
 */

/** Coleções de configuração com CRUD em `/servicedesk/<resource>`. */
export type SdConfigResource =
  | 'departments'
  | 'categories'
  | 'classifications'
  | 'impacts'
  | 'urgencies'
  | 'priorities'
  | 'severities'
  | 'phases'
  | 'calendars'
  | 'sla-policies'
  | 'escalation-rules'
  | 'automation-rules'
  | 'custom-fields'
  | 'ticket-templates'
  | 'canned-responses'
  | 'parts'

type QueryParams = Record<string, string | boolean | undefined>

export const sdConfigKeys = {
  all: (workspaceId: string) => ['sd-config', workspaceId] as const,
  bootstrap: (workspaceId: string) =>
    ['sd-config', workspaceId, 'bootstrap'] as const,
  me: (workspaceId: string) => ['sd-config', workspaceId, 'me'] as const,
  agents: (workspaceId: string, includeRequesters: boolean) =>
    ['sd-config', workspaceId, 'agents', includeRequesters] as const,
  settings: (workspaceId: string) =>
    ['sd-config', workspaceId, 'settings'] as const,
  list: (workspaceId: string, resource: string, params: QueryParams = {}) =>
    ['sd-config', workspaceId, resource, params] as const,
}

function base(workspaceId: string) {
  return `/api/workspaces/${workspaceId}/servicedesk`
}

function withQuery(url: string, params: QueryParams = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function useInvalidateSdConfig(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: sdConfigKeys.all(workspaceId) })
}

// ── Leituras para a UI de chamados ─────────────────────────────────────────

/** Pacote único de configuração (fases, catálogo, escalas, campos...). */
export function useSdConfig(workspaceId: string) {
  return useQuery({
    queryKey: sdConfigKeys.bootstrap(workspaceId),
    queryFn: () =>
      apiFetch<SdConfigBootstrapDTO>(
        `${base(workspaceId)}/config`,
        undefined,
        'Erro ao carregar a configuração do ServiceDesk',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

/** Papel do usuário: agente/admin e departamentos. */
export function useSdMe(workspaceId: string) {
  return useQuery({
    queryKey: sdConfigKeys.me(workspaceId),
    queryFn: () =>
      apiFetch<SdMeDTO>(
        `${base(workspaceId)}/me`,
        undefined,
        'Erro ao carregar seu perfil no ServiceDesk',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

/** Agentes (seletores de responsável); `includeRequesters` traz todos. */
export function useSdAgents(
  workspaceId: string,
  options: { includeRequesters?: boolean; enabled?: boolean } = {},
) {
  const includeRequesters = options.includeRequesters ?? false
  return useQuery({
    queryKey: sdConfigKeys.agents(workspaceId, includeRequesters),
    queryFn: () =>
      apiFetch<SdAgentDTO[]>(
        withQuery(`${base(workspaceId)}/agents`, {
          includeRequesters: includeRequesters || undefined,
        }),
        undefined,
        'Erro ao carregar os agentes',
      ),
    enabled: !!workspaceId && (options.enabled ?? true),
    staleTime: 60 * 1000,
  })
}

// ── Configuração geral ─────────────────────────────────────────────────────

export function useSdSettings(workspaceId: string) {
  return useQuery({
    queryKey: sdConfigKeys.settings(workspaceId),
    queryFn: () =>
      apiFetch<SdSettingsDTO>(
        `${base(workspaceId)}/settings`,
        undefined,
        'Erro ao carregar as configurações do ServiceDesk',
      ),
    enabled: !!workspaceId,
  })
}

export function useUpdateSdSettings(workspaceId: string) {
  const invalidate = useInvalidateSdConfig(workspaceId)
  return useMutation({
    mutationFn: (data: UpdateSdSettingsDTO) =>
      apiFetch<SdSettingsDTO>(
        `${base(workspaceId)}/settings`,
        json('PATCH', data),
        'Erro ao salvar as configurações',
      ),
    onSuccess: invalidate,
  })
}

/** Recria o que falta dos padrões ITIL (idempotente). */
export function useRestoreSdDefaults(workspaceId: string) {
  const invalidate = useInvalidateSdConfig(workspaceId)
  return useMutation({
    mutationFn: () =>
      apiFetch<SdSeedSummary>(
        `${base(workspaceId)}/settings/restore-defaults`,
        json('POST', {}),
        'Erro ao restaurar os padrões',
      ),
    onSuccess: invalidate,
  })
}

// ── Coleções genéricas ─────────────────────────────────────────────────────

/** Lista de uma coleção de configuração (com query opcional). */
export function useSdConfigList<T>(
  workspaceId: string,
  resource: SdConfigResource,
  params: QueryParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdConfigKeys.list(workspaceId, resource, params),
    queryFn: () =>
      apiFetch<T[]>(
        withQuery(`${base(workspaceId)}/${resource}`, params),
        undefined,
        'Erro ao carregar a configuração',
      ),
    enabled: !!workspaceId && (options.enabled ?? true),
  })
}

/** Criar/atualizar/excluir/reordenar itens de uma coleção. */
export function useSdConfigMutations<T, TCreate = unknown, TUpdate = unknown>(
  workspaceId: string,
  resource: SdConfigResource,
) {
  const invalidate = useInvalidateSdConfig(workspaceId)
  const url = `${base(workspaceId)}/${resource}`

  const create = useMutation({
    mutationFn: (data: TCreate) =>
      apiFetch<T>(url, json('POST', data), 'Erro ao criar'),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TUpdate }) =>
      apiFetch<T>(`${url}/${id}`, json('PATCH', data), 'Erro ao salvar'),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiSend(`${url}/${id}`, { method: 'DELETE' }, 'Erro ao excluir'),
    onSuccess: invalidate,
  })
  const reorder = useMutation({
    mutationFn: (body: {
      orderedIds: string[]
      ticketType?: SdTicketTypeDTO
    }) => apiSend(`${url}/reorder`, json('PATCH', body), 'Erro ao reordenar'),
    onSettled: invalidate,
  })
  return { create, update, remove, reorder }
}

// ── Específicos ────────────────────────────────────────────────────────────

export function useSdDepartmentMembers(workspaceId: string) {
  const invalidate = useInvalidateSdConfig(workspaceId)
  const url = (departmentId: string) =>
    `${base(workspaceId)}/departments/${departmentId}/members`

  const add = useMutation({
    mutationFn: (input: {
      departmentId: string
      userId: string
      isLead?: boolean
    }) =>
      apiFetch<SdDepartmentDTO>(
        url(input.departmentId),
        json('POST', { userId: input.userId, isLead: input.isLead ?? false }),
        'Erro ao adicionar membro',
      ),
    onSuccess: invalidate,
  })
  const setLead = useMutation({
    mutationFn: (input: {
      departmentId: string
      userId: string
      isLead: boolean
    }) =>
      apiFetch<SdDepartmentDTO>(
        `${url(input.departmentId)}/${input.userId}`,
        json('PATCH', { isLead: input.isLead }),
        'Erro ao atualizar membro',
      ),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (input: { departmentId: string; userId: string }) =>
      apiFetch<SdDepartmentDTO>(
        `${url(input.departmentId)}/${input.userId}`,
        { method: 'DELETE' },
        'Erro ao remover membro',
      ),
    onSuccess: invalidate,
  })
  return { add, setLead, remove }
}

export function useSdPriorityMatrix(workspaceId: string) {
  return useQuery({
    queryKey: sdConfigKeys.list(workspaceId, 'priority-matrix'),
    queryFn: () =>
      apiFetch<SdPriorityMatrixCellDTO[]>(
        `${base(workspaceId)}/priority-matrix`,
        undefined,
        'Erro ao carregar a matriz de prioridade',
      ),
    enabled: !!workspaceId,
  })
}

export function useSaveSdPriorityMatrix(workspaceId: string) {
  const invalidate = useInvalidateSdConfig(workspaceId)
  return useMutation({
    mutationFn: (cells: SdPriorityMatrixCellDTO[]) =>
      apiFetch<SdPriorityMatrixCellDTO[]>(
        `${base(workspaceId)}/priority-matrix`,
        json('PUT', { cells }),
        'Erro ao salvar a matriz',
      ),
    onSuccess: invalidate,
  })
}

export function useSdPhaseTransitions(
  workspaceId: string,
  ticketType: SdTicketTypeDTO,
) {
  return useQuery({
    queryKey: sdConfigKeys.list(workspaceId, 'phase-transitions', {
      ticketType,
    }),
    queryFn: () =>
      apiFetch<SdPhaseTransitionDTO[]>(
        withQuery(`${base(workspaceId)}/phases/transitions`, {
          type: ticketType,
        }),
        undefined,
        'Erro ao carregar as transições',
      ),
    enabled: !!workspaceId,
  })
}

export function useSaveSdPhaseTransitions(
  workspaceId: string,
  ticketType: SdTicketTypeDTO,
) {
  const invalidate = useInvalidateSdConfig(workspaceId)
  return useMutation({
    mutationFn: (
      transitions: {
        fromPhaseId: string
        toPhaseId: string
        allowedDepartmentIds: string[]
      }[],
    ) =>
      apiFetch<SdPhaseTransitionDTO[]>(
        withQuery(`${base(workspaceId)}/phases/transitions`, {
          type: ticketType,
        }),
        json('PUT', { transitions }),
        'Erro ao salvar as transições',
      ),
    onSuccess: invalidate,
  })
}
