'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { SdCepAddress } from '@/types/sd-cep'
import type {
  SdCustomerDetailDTO,
  SdCustomerDTO,
  SdCustomerKindDTO,
  SdPersonTypeDTO,
} from '@/types/sd-customer'
import type {
  SdCustomFieldValuesDTO,
  SdOptionDTO,
  SdPage,
} from '@/types/sd-directory'
import { apiFetch, apiSend } from './_fetch'
import { fetchSdOptions, sdBase, sdJson, sdQueryString } from './_sd-directory'

export interface SdCustomersQuery {
  q?: string
  kind?: SdCustomerKindDTO
  active?: boolean
  state?: string
  city?: string
  page?: number
  pageSize?: number
  sort?: 'name' | 'tradeName' | 'document' | 'city' | 'createdAt' | 'updatedAt'
  order?: 'asc' | 'desc'
}

/** Corpo de criação/edição (`null` limpa o campo na edição). */
export interface SdCustomerInput {
  kind?: SdCustomerKindDTO
  personType?: SdPersonTypeDTO
  name?: string
  tradeName?: string | null
  document?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  zipCode?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  district?: string | null
  city?: string | null
  state?: string | null
  ibgeCode?: string | null
  notes?: string | null
  customFields?: SdCustomFieldValuesDTO
  active?: boolean
}

const KEY = 'sd-customers'

export function useSdCustomers(workspaceId: string, query: SdCustomersQuery) {
  return useQuery({
    queryKey: [KEY, workspaceId, 'list', query],
    queryFn: () =>
      apiFetch<SdPage<SdCustomerDTO>>(
        `${sdBase(workspaceId, 'customers')}${sdQueryString({ ...query })}`,
        undefined,
        'Erro ao buscar cadastros',
      ),
    placeholderData: keepPreviousData,
    enabled: Boolean(workspaceId),
  })
}

export function useSdCustomer(workspaceId: string, customerId: string | null) {
  return useQuery({
    queryKey: [KEY, workspaceId, 'detail', customerId],
    queryFn: () =>
      apiFetch<SdCustomerDetailDTO>(
        sdBase(workspaceId, `customers/${customerId}`),
        undefined,
        'Erro ao buscar o cadastro',
      ),
    enabled: Boolean(workspaceId && customerId),
  })
}

export function useSdCustomerOptions(
  workspaceId: string,
  params: { q?: string; kind?: SdCustomerKindDTO; enabled?: boolean },
) {
  return useQuery<SdOptionDTO[]>({
    queryKey: [KEY, workspaceId, 'options', params.q ?? '', params.kind ?? ''],
    queryFn: () =>
      fetchSdOptions(workspaceId, 'customers/options', {
        q: params.q,
        kind: params.kind,
      }),
    enabled: Boolean(workspaceId) && params.enabled !== false,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  })
}

function useInvalidate(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [KEY, workspaceId] })
}

export function useCreateSdCustomer(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (data: SdCustomerInput & { name: string }) =>
      apiFetch<SdCustomerDTO>(
        sdBase(workspaceId, 'customers'),
        sdJson('POST', data),
        'Erro ao criar o cadastro',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdCustomer(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdCustomerInput }) =>
      apiFetch<SdCustomerDTO>(
        sdBase(workspaceId, `customers/${id}`),
        sdJson('PATCH', data),
        'Erro ao salvar o cadastro',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdCustomer(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        sdBase(workspaceId, `customers/${id}`),
        { method: 'DELETE' },
        'Erro ao excluir o cadastro',
      ),
    onSuccess: invalidate,
  })
}

/** Consulta de CEP (ViaCEP via servidor). */
export function fetchSdCep(
  workspaceId: string,
  cep: string,
): Promise<SdCepAddress> {
  return apiFetch<SdCepAddress>(
    sdBase(workspaceId, `cep/${cep.replace(/\D/g, '')}`),
    undefined,
    'Não foi possível consultar o CEP',
  )
}
