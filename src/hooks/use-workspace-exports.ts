import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateWorkspaceExportDTO } from '@/src/schemas/workspace-export.schema'
import type {
  WorkspaceExportDTO,
  WorkspaceExportOverviewDTO,
} from '@/types/workspace-export'
import { apiFetch, apiFetchJson } from './_fetch'

/** Ajustes › Exportações: history, today's availability and new requests. */

export const workspaceExportsKey = (workspaceId: string) =>
  ['workspace-exports', workspaceId] as const

/** Poll while an export is being built so the link shows up by itself. */
export const EXPORTS_POLL_MS = 5000

export function isExportInFlight(
  overview: WorkspaceExportOverviewDTO | undefined,
): boolean {
  return (
    overview?.items.some(
      (item) => item.status === 'PENDING' || item.status === 'RUNNING',
    ) ?? false
  )
}

export function useWorkspaceExports(workspaceId: string) {
  return useQuery({
    queryKey: workspaceExportsKey(workspaceId),
    queryFn: () =>
      apiFetch<WorkspaceExportOverviewDTO>(
        `/api/workspaces/${workspaceId}/exports`,
        undefined,
        'Erro ao carregar as exportações',
      ),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      isExportInFlight(query.state.data) ? EXPORTS_POLL_MS : false,
  })
}

export function useRequestWorkspaceExport(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWorkspaceExportDTO) =>
      apiFetchJson<WorkspaceExportDTO>(
        `/api/workspaces/${workspaceId}/exports`,
        'POST',
        input,
        'Não foi possível pedir a exportação',
      ),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: workspaceExportsKey(workspaceId) }),
  })
}
