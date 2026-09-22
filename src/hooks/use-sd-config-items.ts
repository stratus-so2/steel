'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  SdCiAttributeDefinitionDTO,
  SdConfigItemDetailDTO,
  SdConfigItemDTO,
  SdConfigItemStatusDTO,
  SdConfigItemTypeDTO,
  SdRiskLevelDTO,
} from '@/types/sd-config-item'
import type {
  SdCustomFieldValuesDTO,
  SdOptionDTO,
  SdPage,
} from '@/types/sd-directory'
import { apiFetch, apiSend } from './_fetch'
import { fetchSdOptions, sdBase, sdJson, sdQueryString } from './_sd-directory'

export interface SdConfigItemsQuery {
  q?: string
  typeId?: string
  status?: SdConfigItemStatusDTO
  criticality?: SdRiskLevelDTO
  customerId?: string
  departmentId?: string
  parentId?: string
  warrantyExpiringInDays?: number
  page?: number
  pageSize?: number
  sort?:
    | 'name'
    | 'code'
    | 'status'
    | 'criticality'
    | 'warrantyUntil'
    | 'createdAt'
    | 'updatedAt'
  order?: 'asc' | 'desc'
}

export interface SdConfigItemInput {
  name?: string
  typeId?: string | null
  parentId?: string | null
  code?: string | null
  status?: SdConfigItemStatusDTO
  criticality?: SdRiskLevelDTO
  customerId?: string | null
  departmentId?: string | null
  ownerId?: string | null
  serialNumber?: string | null
  manufacturer?: string | null
  model?: string | null
  location?: string | null
  ipAddress?: string | null
  /** `YYYY-MM-DD`. */
  purchasedAt?: string | null
  warrantyUntil?: string | null
  attributes?: Record<string, string | number | boolean | null>
  customFields?: SdCustomFieldValuesDTO
  notes?: string | null
}

export interface SdConfigItemTypeInput {
  name?: string
  icon?: string | null
  color?: string | null
  attributeSchema?: SdCiAttributeDefinitionDTO[]
  position?: number
}

const KEY = 'sd-config-items'
const TYPES_KEY = 'sd-config-item-types'

export function useSdConfigItems(
  workspaceId: string,
  query: SdConfigItemsQuery,
) {
  return useQuery({
    queryKey: [KEY, workspaceId, 'list', query],
    queryFn: () =>
      apiFetch<SdPage<SdConfigItemDTO>>(
        `${sdBase(workspaceId, 'config-items')}${sdQueryString({ ...query })}`,
        undefined,
        'Erro ao buscar itens de configuração',
      ),
    placeholderData: keepPreviousData,
    enabled: Boolean(workspaceId),
  })
}

export function useSdConfigItem(workspaceId: string, itemId: string | null) {
  return useQuery({
    queryKey: [KEY, workspaceId, 'detail', itemId],
    queryFn: () =>
      apiFetch<SdConfigItemDetailDTO>(
        sdBase(workspaceId, `config-items/${itemId}`),
        undefined,
        'Erro ao buscar o item',
      ),
    enabled: Boolean(workspaceId && itemId),
  })
}

export function useSdConfigItemOptions(
  workspaceId: string,
  params: {
    q?: string
    customerId?: string
    excludeId?: string
    enabled?: boolean
  },
) {
  return useQuery<SdOptionDTO[]>({
    queryKey: [
      KEY,
      workspaceId,
      'options',
      params.q ?? '',
      params.customerId ?? '',
      params.excludeId ?? '',
    ],
    queryFn: () =>
      fetchSdOptions(workspaceId, 'config-items/options', {
        q: params.q,
        customerId: params.customerId,
        excludeId: params.excludeId,
      }),
    enabled: Boolean(workspaceId) && params.enabled !== false,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  })
}

function useInvalidate(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY, workspaceId] })
    queryClient.invalidateQueries({ queryKey: ['sd-customers', workspaceId] })
  }
}

export function useCreateSdConfigItem(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (data: SdConfigItemInput & { name: string }) =>
      apiFetch<SdConfigItemDTO>(
        sdBase(workspaceId, 'config-items'),
        sdJson('POST', data),
        'Erro ao criar o item',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdConfigItem(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdConfigItemInput }) =>
      apiFetch<SdConfigItemDTO>(
        sdBase(workspaceId, `config-items/${id}`),
        sdJson('PATCH', data),
        'Erro ao salvar o item',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdConfigItem(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        sdBase(workspaceId, `config-items/${id}`),
        { method: 'DELETE' },
        'Erro ao excluir o item',
      ),
    onSuccess: invalidate,
  })
}

/* ------------------------------ tipos de CI ------------------------------ */

export function useSdConfigItemTypes(workspaceId: string) {
  return useQuery({
    queryKey: [TYPES_KEY, workspaceId],
    queryFn: () =>
      apiFetch<SdConfigItemTypeDTO[]>(
        sdBase(workspaceId, 'config-item-types'),
        undefined,
        'Erro ao buscar tipos de item',
      ),
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000,
  })
}

function useInvalidateTypes(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: [TYPES_KEY, workspaceId] })
    queryClient.invalidateQueries({ queryKey: [KEY, workspaceId] })
  }
}

export function useCreateSdConfigItemType(workspaceId: string) {
  const invalidate = useInvalidateTypes(workspaceId)
  return useMutation({
    mutationFn: (data: SdConfigItemTypeInput & { name: string }) =>
      apiFetch<SdConfigItemTypeDTO>(
        sdBase(workspaceId, 'config-item-types'),
        sdJson('POST', data),
        'Erro ao criar o tipo',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdConfigItemType(workspaceId: string) {
  const invalidate = useInvalidateTypes(workspaceId)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdConfigItemTypeInput }) =>
      apiFetch<SdConfigItemTypeDTO>(
        sdBase(workspaceId, `config-item-types/${id}`),
        sdJson('PATCH', data),
        'Erro ao salvar o tipo',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdConfigItemType(workspaceId: string) {
  const invalidate = useInvalidateTypes(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        sdBase(workspaceId, `config-item-types/${id}`),
        { method: 'DELETE' },
        'Erro ao excluir o tipo',
      ),
    onSuccess: invalidate,
  })
}

/**
 * Departamentos para o seletor do CI. A rota é da fatia de configuração
 * (`servicedesk/departments`); se ainda não existir, devolve lista vazia e o
 * campo some do formulário.
 */
export function useSdDepartmentOptions(workspaceId: string) {
  return useQuery({
    queryKey: ['sd-departments', workspaceId, 'directory-options'],
    queryFn: async () => {
      try {
        const rows = await apiFetch<{ id: string; name: string }[]>(
          sdBase(workspaceId, 'departments'),
        )
        return Array.isArray(rows)
          ? rows.map((d) => ({ id: d.id, name: d.name }))
          : []
      } catch {
        return []
      }
    },
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000,
  })
}
