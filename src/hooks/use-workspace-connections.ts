import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ModuleKind,
  WorkspaceConnectionDTO,
} from '@/types/workspace-connection'
import { apiFetch, apiSend } from './_fetch'

const CONNECTIONS_KEY = (workspaceId: string) =>
  ['workspace-connections', workspaceId] as const

interface SaveConnectionInput {
  host: string
  port: number
  username: string
  password: string
  database: string
  sslEnabled?: boolean
}

interface TestConnectionInput extends SaveConnectionInput {
  module: ModuleKind
}

export function useWorkspaceConnections(workspaceId: string) {
  return useQuery({
    queryKey: CONNECTIONS_KEY(workspaceId),
    queryFn: () =>
      apiFetch<WorkspaceConnectionDTO[]>(
        `/api/workspaces/${workspaceId}/connections`,
        undefined,
        'Erro ao buscar conexões do workspace',
      ),
    staleTime: 60 * 1000,
  })
}

export function useSaveWorkspaceConnection(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      module,
      ...data
    }: SaveConnectionInput & { module: ModuleKind }) =>
      apiFetch<WorkspaceConnectionDTO>(
        `/api/workspaces/${workspaceId}/connections/${module}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao salvar conexão',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY(workspaceId) })
    },
  })
}

export function useDeleteWorkspaceConnection(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (module: ModuleKind) =>
      apiSend(
        `/api/workspaces/${workspaceId}/connections/${module}`,
        { method: 'DELETE' },
        'Erro ao remover conexão',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY(workspaceId) })
    },
  })
}

export function useTestWorkspaceConnection(workspaceId: string) {
  return useMutation({
    mutationFn: (data: TestConnectionInput) =>
      apiFetch<{ ok: true }>(
        `/api/workspaces/${workspaceId}/connections/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Não foi possível conectar ao banco de dados informado',
      ),
  })
}
