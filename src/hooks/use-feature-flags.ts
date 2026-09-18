'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeatureKey } from '@/src/config/features'
import type {
  WorkspaceFeatureDTO,
  WorkspaceFeatureMapDTO,
} from '@/types/feature-flag'
import { apiFetch } from './_fetch'

const workspaceFeaturesKey = (workspaceId: string) =>
  ['workspace', workspaceId, 'features'] as const

const adminFeaturesKey = (workspaceId: string) =>
  ['admin', 'workspace', workspaceId, 'features'] as const

/** Mapa efetivo de feature flags do workspace (membros). */
export function useWorkspaceFeatures(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceFeaturesKey(workspaceId ?? ''),
    queryFn: () =>
      apiFetch<WorkspaceFeatureMapDTO>(
        `/api/workspaces/${workspaceId}/features`,
        undefined,
        'Erro ao carregar funcionalidades do workspace',
      ),
    enabled: Boolean(workspaceId),
    // Muda raramente (override do admin ou troca de plano).
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Uma feature específica, para esconder UI. `enabled` fica `false` enquanto
 * carrega ou se a leitura falhar — o gate de verdade é no service, então errar
 * para o lado de esconder não libera nada indevido.
 */
export function useFeature(workspaceId: string | undefined, key: FeatureKey) {
  const { data, isLoading, isError } = useWorkspaceFeatures(workspaceId)
  return {
    enabled: data?.[key] ?? false,
    isLoading,
    isError,
  }
}

/** Painel admin: catálogo com default do plano, override e valor efetivo. */
export function useAdminWorkspaceFeatures(workspaceId: string) {
  return useQuery({
    queryKey: adminFeaturesKey(workspaceId),
    queryFn: () =>
      apiFetch<WorkspaceFeatureDTO[]>(
        `/api/admin/workspaces/${workspaceId}/features`,
        undefined,
        'Erro ao carregar as funcionalidades',
      ),
    enabled: Boolean(workspaceId),
  })
}

export interface SetFeatureOverrideVariables {
  key: FeatureKey
  /** `null` volta ao default do plano. */
  enabled: boolean | null
  note?: string | null
  /** ISO 8601 ou `null`. */
  expiresAt?: string | null
}

export function useSetWorkspaceFeatureOverride(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: SetFeatureOverrideVariables) =>
      apiFetch<WorkspaceFeatureDTO[]>(
        `/api/admin/workspaces/${workspaceId}/features`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(variables),
        },
        'Erro ao salvar a funcionalidade',
      ),
    onSuccess: (list) => {
      queryClient.setQueryData(adminFeaturesKey(workspaceId), list)
      queryClient.invalidateQueries({
        queryKey: workspaceFeaturesKey(workspaceId),
      })
    },
  })
}
