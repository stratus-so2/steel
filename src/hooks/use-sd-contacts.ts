'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { SdContactDetailDTO, SdContactDTO } from '@/types/sd-contact'
import type {
  SdCustomFieldValuesDTO,
  SdImportResultDTO,
  SdOptionDTO,
  SdPage,
} from '@/types/sd-directory'
import { apiFetch, apiSend } from './_fetch'
import { fetchSdOptions, sdBase, sdJson, sdQueryString } from './_sd-directory'

export interface SdContactsQuery {
  q?: string
  customerId?: string
  active?: boolean
  page?: number
  pageSize?: number
  sort?: 'name' | 'jobTitle' | 'email' | 'createdAt' | 'updatedAt'
  order?: 'asc' | 'desc'
}

export interface SdContactInput {
  name?: string
  jobTitle?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  userId?: string | null
  notes?: string | null
  customers?: { customerId: string; isPrimary?: boolean }[]
  customFields?: SdCustomFieldValuesDTO
  active?: boolean
}

const KEY = 'sd-contacts'

export function useSdContacts(workspaceId: string, query: SdContactsQuery) {
  return useQuery({
    queryKey: [KEY, workspaceId, 'list', query],
    queryFn: () =>
      apiFetch<SdPage<SdContactDTO>>(
        `${sdBase(workspaceId, 'contacts')}${sdQueryString({ ...query })}`,
        undefined,
        'Erro ao buscar contatos',
      ),
    placeholderData: keepPreviousData,
    enabled: Boolean(workspaceId),
  })
}

export function useSdContact(workspaceId: string, contactId: string | null) {
  return useQuery({
    queryKey: [KEY, workspaceId, 'detail', contactId],
    queryFn: () =>
      apiFetch<SdContactDetailDTO>(
        sdBase(workspaceId, `contacts/${contactId}`),
        undefined,
        'Erro ao buscar o contato',
      ),
    enabled: Boolean(workspaceId && contactId),
  })
}

export function useSdContactOptions(
  workspaceId: string,
  params: { q?: string; customerId?: string; enabled?: boolean },
) {
  return useQuery<SdOptionDTO[]>({
    queryKey: [
      KEY,
      workspaceId,
      'options',
      params.q ?? '',
      params.customerId ?? '',
    ],
    queryFn: () =>
      fetchSdOptions(workspaceId, 'contacts/options', {
        q: params.q,
        customerId: params.customerId,
      }),
    enabled: Boolean(workspaceId) && params.enabled !== false,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  })
}

/** Membros do workspace (usuário do contato, responsável do CI). */
export function useSdUserOptions(
  workspaceId: string,
  params: { q?: string; enabled?: boolean },
) {
  return useQuery<SdOptionDTO[]>({
    queryKey: [KEY, workspaceId, 'user-options', params.q ?? ''],
    queryFn: () =>
      fetchSdOptions(workspaceId, 'contacts/user-options', { q: params.q }),
    enabled: Boolean(workspaceId) && params.enabled !== false,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })
}

function useInvalidate(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY, workspaceId] })
    // Contagens e abas "Contatos" dos clientes.
    queryClient.invalidateQueries({ queryKey: ['sd-customers', workspaceId] })
  }
}

export function useCreateSdContact(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (data: SdContactInput & { name: string }) =>
      apiFetch<SdContactDTO>(
        sdBase(workspaceId, 'contacts'),
        sdJson('POST', data),
        'Erro ao criar o contato',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdContact(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SdContactInput }) =>
      apiFetch<SdContactDTO>(
        sdBase(workspaceId, `contacts/${id}`),
        sdJson('PATCH', data),
        'Erro ao salvar o contato',
      ),
    onSuccess: invalidate,
  })
}

/** Importação de planilha de contatos (linhas já convertidas do CSV). */
export function useImportSdContacts(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (data: { rows: Record<string, string>[] }) =>
      apiFetch<SdImportResultDTO>(
        sdBase(workspaceId, 'contacts/import'),
        sdJson('POST', data),
        'Erro ao importar a planilha',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdContact(workspaceId: string) {
  const invalidate = useInvalidate(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        sdBase(workspaceId, `contacts/${id}`),
        { method: 'DELETE' },
        'Erro ao excluir o contato',
      ),
    onSuccess: invalidate,
  })
}
