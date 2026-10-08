import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type {
  WorkspaceCompanySizeDTO,
  WorkspaceDeletionDTO,
  WorkspaceDTO,
  WorkspaceSlugAvailabilityDTO,
} from '@/types/workspace'
import { apiFetch } from './_fetch'

const WORKSPACE_KEY = ['workspace'] as const
const USER_KEY = ['user'] as const
const BASE_API_ROUTE = '/api/workspaces'

/** Debounce of the live slug check, in ms. */
export const SLUG_CHECK_DEBOUNCE_MS = 400

export function useWorkspace(workspaceId: string | null) {
  return useQuery({
    queryKey: [WORKSPACE_KEY, workspaceId],
    queryFn: () =>
      apiFetch<WorkspaceDTO>(
        `${BASE_API_ROUTE}/${workspaceId}`,
        undefined,
        'Erro ao buscar workspace',
      ),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      apiFetch<WorkspaceDTO>(
        BASE_API_ROUTE,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar workspace',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY })
      queryClient.invalidateQueries({ queryKey: [USER_KEY] })
    },
  })
}

export interface UpdateWorkspaceInput {
  name?: string
  slug?: string
  companySize?: WorkspaceCompanySizeDTO | null
}

export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateWorkspaceInput) =>
      apiFetch<WorkspaceDTO>(
        `${BASE_API_ROUTE}/${workspaceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao atualizar workspace',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKSPACE_KEY, workspaceId] })
      // The workspace switcher reads name/slug/logo from the user DTO.
      queryClient.invalidateQueries({ queryKey: [USER_KEY] })
    },
  })
}

/**
 * Owner-only: queues the permanent deletion (the worker backs up, cancels the
 * subscriptions and purges in the background). `confirmation` is the slug.
 */
export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { confirmation: string }) =>
      apiFetch<WorkspaceDeletionDTO>(
        `${BASE_API_ROUTE}/${workspaceId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao excluir workspace',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY })
      queryClient.invalidateQueries({ queryKey: [USER_KEY] })
    },
  })
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * Live availability of a new workspace slug (format, reserved words,
 * uniqueness), debounced. `isFetching` stays true while the user is typing.
 */
export function useWorkspaceSlugAvailability(
  workspaceId: string,
  slug: string,
  enabled: boolean,
) {
  const debounced = useDebouncedValue(slug, SLUG_CHECK_DEBOUNCE_MS)
  const query = useQuery({
    queryKey: [WORKSPACE_KEY, workspaceId, 'slug-availability', debounced],
    queryFn: () =>
      apiFetch<WorkspaceSlugAvailabilityDTO>(
        `${BASE_API_ROUTE}/${workspaceId}/slug-availability?slug=${encodeURIComponent(debounced)}`,
        undefined,
        'Erro ao verificar o endereço',
      ),
    enabled: enabled && debounced === slug,
    staleTime: 30 * 1000,
  })
  const pending = enabled && debounced !== slug
  return {
    data: pending ? undefined : query.data,
    isFetching: pending || query.isFetching,
    error: query.error,
  }
}

export function useUploadWorkspaceLogo(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return apiFetch<WorkspaceDTO>(
        `${BASE_API_ROUTE}/${workspaceId}/logo`,
        { method: 'POST', body: form },
        'Erro ao enviar o logo',
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKSPACE_KEY, workspaceId] })
      queryClient.invalidateQueries({ queryKey: [USER_KEY] })
    },
  })
}

export function useRemoveWorkspaceLogo(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<WorkspaceDTO>(
        `${BASE_API_ROUTE}/${workspaceId}/logo`,
        { method: 'DELETE' },
        'Erro ao remover o logo',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKSPACE_KEY, workspaceId] })
      queryClient.invalidateQueries({ queryKey: [USER_KEY] })
    },
  })
}
