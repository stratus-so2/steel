import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateSdOnCallLayerDTO,
  CreateSdOnCallOverrideDTO,
  CreateSdOnCallScheduleDTO,
  UpdateSdOnCallLayerDTO,
  UpdateSdOnCallScheduleDTO,
} from '@/src/schemas/sd-oncall.schema'
import type {
  SdOnCallNowDTO,
  SdOnCallOverrideDTO,
  SdOnCallScheduleDTO,
  SdOnCallTimelineDTO,
} from '@/types/sd-oncall'
import { apiFetch, apiSend } from './_fetch'

/**
 * Hooks do plantão (on-call) do ServiceDesk. Toda chave começa com
 * `['sd-oncall', workspaceId]`: qualquer mutação invalida o prefixo, então a
 * aba de configuração, a linha do tempo e o indicador de "quem está de
 * plantão agora" se atualizam juntos.
 */

export const sdOnCallKeys = {
  all: (workspaceId: string) => ['sd-oncall', workspaceId] as const,
  schedules: (workspaceId: string, includeInactive: boolean) =>
    ['sd-oncall', workspaceId, 'schedules', includeInactive] as const,
  overrides: (workspaceId: string, scheduleId?: string) =>
    ['sd-oncall', workspaceId, 'overrides', scheduleId ?? 'all'] as const,
  timeline: (workspaceId: string, scheduleId: string, days: number) =>
    ['sd-oncall', workspaceId, 'timeline', scheduleId, days] as const,
  now: (workspaceId: string, departmentId?: string | null) =>
    ['sd-oncall', workspaceId, 'now', departmentId ?? 'all'] as const,
}

function base(workspaceId: string) {
  return `/api/workspaces/${workspaceId}/servicedesk/oncall`
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function useInvalidate(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: sdOnCallKeys.all(workspaceId) })
}

/** Escalas com camadas e participantes (admins veem as inativas também). */
export function useSdOnCallSchedules(
  workspaceId: string,
  options: { includeInactive?: boolean; enabled?: boolean } = {},
) {
  const includeInactive = options.includeInactive ?? false
  return useQuery({
    queryKey: sdOnCallKeys.schedules(workspaceId, includeInactive),
    queryFn: () =>
      apiFetch<SdOnCallScheduleDTO[]>(
        `${base(workspaceId)}${includeInactive ? '?includeInactive=true' : ''}`,
        undefined,
        'Erro ao carregar as escalas de plantão',
      ),
    enabled: !!workspaceId && (options.enabled ?? true),
  })
}

/** Trocas que ainda não terminaram. */
export function useSdOnCallOverrides(
  workspaceId: string,
  options: { scheduleId?: string; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdOnCallKeys.overrides(workspaceId, options.scheduleId),
    queryFn: () =>
      apiFetch<SdOnCallOverrideDTO[]>(
        `${base(workspaceId)}/overrides${options.scheduleId ? `?scheduleId=${options.scheduleId}` : ''}`,
        undefined,
        'Erro ao carregar as trocas de plantão',
      ),
    enabled: !!workspaceId && (options.enabled ?? true),
  })
}

/** Linha do tempo (padrão: as próximas duas semanas). */
export function useSdOnCallTimeline(
  workspaceId: string,
  scheduleId: string | null,
  options: { days?: number } = {},
) {
  const days = options.days ?? 14
  return useQuery({
    queryKey: sdOnCallKeys.timeline(workspaceId, scheduleId ?? '', days),
    queryFn: () =>
      apiFetch<SdOnCallTimelineDTO>(
        `${base(workspaceId)}/${scheduleId}/timeline?days=${days}`,
        undefined,
        'Erro ao carregar a linha do tempo do plantão',
      ),
    enabled: !!workspaceId && !!scheduleId,
  })
}

/**
 * Quem está de plantão agora. Com `departmentId`, só a escala que cobre o
 * time (é o indicador do cabeçalho do chamado e do quadro).
 */
export function useSdOnCallNow(
  workspaceId: string,
  options: { departmentId?: string | null; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdOnCallKeys.now(workspaceId, options.departmentId),
    queryFn: () =>
      apiFetch<SdOnCallNowDTO[]>(
        `${base(workspaceId)}/now${options.departmentId ? `?departmentId=${options.departmentId}` : ''}`,
        undefined,
        'Erro ao carregar o plantão',
      ),
    enabled: !!workspaceId && (options.enabled ?? true),
    // O rodízio vira na hora marcada: um minuto de frescor basta.
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

/** Mutações da escala, das camadas, dos participantes e das trocas. */
export function useSdOnCallMutations(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  const url = base(workspaceId)

  const create = useMutation({
    mutationFn: (data: CreateSdOnCallScheduleDTO) =>
      apiFetch<SdOnCallScheduleDTO>(
        url,
        json('POST', data),
        'Erro ao criar a escala',
      ),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({
      scheduleId,
      data,
    }: {
      scheduleId: string
      data: UpdateSdOnCallScheduleDTO
    }) =>
      apiFetch<SdOnCallScheduleDTO>(
        `${url}/${scheduleId}`,
        json('PATCH', data),
        'Erro ao salvar a escala',
      ),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (scheduleId: string) =>
      apiSend(
        `${url}/${scheduleId}`,
        { method: 'DELETE' },
        'Erro ao excluir a escala',
      ),
    onSuccess: invalidate,
  })
  const addLayer = useMutation({
    mutationFn: ({
      scheduleId,
      data,
    }: {
      scheduleId: string
      data: CreateSdOnCallLayerDTO
    }) =>
      apiFetch<SdOnCallScheduleDTO>(
        `${url}/${scheduleId}/layers`,
        json('POST', data),
        'Erro ao criar a camada',
      ),
    onSuccess: invalidate,
  })
  const updateLayer = useMutation({
    mutationFn: ({
      scheduleId,
      layerId,
      data,
    }: {
      scheduleId: string
      layerId: string
      data: UpdateSdOnCallLayerDTO
    }) =>
      apiFetch<SdOnCallScheduleDTO>(
        `${url}/${scheduleId}/layers/${layerId}`,
        json('PATCH', data),
        'Erro ao salvar a camada',
      ),
    onSuccess: invalidate,
  })
  const removeLayer = useMutation({
    mutationFn: ({
      scheduleId,
      layerId,
    }: {
      scheduleId: string
      layerId: string
    }) =>
      apiSend(
        `${url}/${scheduleId}/layers/${layerId}`,
        { method: 'DELETE' },
        'Erro ao excluir a camada',
      ),
    onSuccess: invalidate,
  })
  /** A ordem do array é a ordem do rodízio (é o que o arrastar manda). */
  const setParticipants = useMutation({
    mutationFn: ({
      scheduleId,
      layerId,
      userIds,
    }: {
      scheduleId: string
      layerId: string
      userIds: string[]
    }) =>
      apiFetch<SdOnCallScheduleDTO>(
        `${url}/${scheduleId}/layers/${layerId}/participants`,
        json('PUT', { userIds }),
        'Erro ao salvar os participantes',
      ),
    onSuccess: invalidate,
  })
  const createOverride = useMutation({
    mutationFn: (data: CreateSdOnCallOverrideDTO) =>
      apiFetch<SdOnCallOverrideDTO>(
        `${url}/overrides`,
        json('POST', data),
        'Erro ao registrar a troca',
      ),
    onSuccess: invalidate,
  })
  const removeOverride = useMutation({
    mutationFn: (overrideId: string) =>
      apiSend(
        `${url}/overrides/${overrideId}`,
        { method: 'DELETE' },
        'Erro ao excluir a troca',
      ),
    onSuccess: invalidate,
  })

  return {
    create,
    update,
    remove,
    addLayer,
    updateLayer,
    removeLayer,
    setParticipants,
    createOverride,
    removeOverride,
  }
}
