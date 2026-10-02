import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateSdContractDTO,
  UpdateSdContractDTO,
} from '@/src/schemas/sd-contract.schema'
import type {
  SdContractDTO,
  SdContractPeriodDTO,
  SdContractStatusDTO,
  SdContractSummaryDTO,
} from '@/types/sd-contract'
import { apiFetch, apiSend } from './_fetch'
import { sdJson } from './_sd-ticket-tab'

/**
 * Contratos de atendimento: lista/edição na aba "Contratos" das
 * configurações, histórico de períodos e o resumo do contrato vigente de um
 * cliente (bloco da tela do cliente). Leitura por agentes; escrita por
 * admins do módulo (a API recusa o resto).
 */

/** O corpo aceito pela API: datas em ISO e dinheiro em string. */
export interface SdContractInput
  extends Omit<Partial<CreateSdContractDTO>, 'startsAt' | 'endsAt'> {
  startsAt?: string
  endsAt?: string | null
}

export type SdContractUpdateInput = Omit<
  Partial<UpdateSdContractDTO>,
  'startsAt' | 'endsAt'
> & { startsAt?: string; endsAt?: string | null }

export interface SdContractFilters {
  customerId?: string
  status?: SdContractStatusDTO
  q?: string
}

export const sdContractKeys = {
  all: (workspaceId: string) => ['sd-contracts', workspaceId] as const,
  list: (workspaceId: string, filters: SdContractFilters) =>
    ['sd-contracts', workspaceId, 'list', filters] as const,
  periods: (workspaceId: string, contractId: string) =>
    ['sd-contracts', workspaceId, 'periods', contractId] as const,
  summary: (workspaceId: string, customerId: string | null) =>
    ['sd-contracts', workspaceId, 'summary', customerId] as const,
}

function base(workspaceId: string): string {
  return `/api/workspaces/${workspaceId}/servicedesk/contracts`
}

function query(filters: SdContractFilters): string {
  const params = new URLSearchParams()
  if (filters.customerId) params.set('customerId', filters.customerId)
  if (filters.status) params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function useSdContracts(
  workspaceId: string,
  filters: SdContractFilters = {},
) {
  return useQuery({
    queryKey: sdContractKeys.list(workspaceId, filters),
    queryFn: () =>
      apiFetch<SdContractDTO[]>(
        `${base(workspaceId)}${query(filters)}`,
        undefined,
        'Erro ao carregar os contratos',
      ),
    enabled: Boolean(workspaceId),
  })
}

export function useSdContractPeriods(
  workspaceId: string,
  contractId: string | null,
) {
  return useQuery({
    queryKey: sdContractKeys.periods(workspaceId, contractId ?? ''),
    queryFn: () =>
      apiFetch<SdContractPeriodDTO[]>(
        `${base(workspaceId)}/${contractId}/periods`,
        undefined,
        'Erro ao carregar os períodos',
      ),
    enabled: Boolean(workspaceId && contractId),
  })
}

/** Contrato vigente do cliente + consumo do período corrente. */
export function useSdCustomerContract(
  workspaceId: string,
  customerId: string | null,
) {
  return useQuery({
    queryKey: sdContractKeys.summary(workspaceId, customerId),
    queryFn: () =>
      apiFetch<SdContractSummaryDTO>(
        `${base(workspaceId)}/summary?customerId=${encodeURIComponent(customerId ?? '')}`,
        undefined,
        'Erro ao carregar o contrato do cliente',
      ),
    enabled: Boolean(workspaceId && customerId),
  })
}

function useInvalidate(workspaceId: string) {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({ queryKey: sdContractKeys.all(workspaceId) })
}

export function useCreateSdContract(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (input: SdContractInput) =>
      apiFetch<SdContractDTO>(
        base(workspaceId),
        sdJson('POST', input),
        'Erro ao criar o contrato',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdContract(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdContractUpdateInput }) =>
      apiFetch<SdContractDTO>(
        `${base(workspaceId)}/${id}`,
        sdJson('PATCH', data),
        'Erro ao salvar o contrato',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdContract(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${base(workspaceId)}/${id}`,
        { method: 'DELETE' },
        'Erro ao excluir o contrato',
      ),
    onSuccess: invalidate,
  })
}

/** Fechamento manual do período (vazio = o período corrente). */
export function useCloseSdContractPeriod(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: ({
      contractId,
      periodId,
    }: {
      contractId: string
      periodId?: string
    }) =>
      apiFetch<SdContractPeriodDTO>(
        `${base(workspaceId)}/${contractId}/periods/close`,
        sdJson('POST', periodId ? { periodId } : {}),
        'Erro ao fechar o período',
      ),
    onSuccess: invalidate,
  })
}
