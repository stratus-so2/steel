import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmReportDTO } from '@/types/crm-report'
import { apiFetch, apiSend } from './_fetch'

function reportsKey(workspaceId: string) {
  return ['crm-reports', workspaceId] as const
}

export function useCrmReports(workspaceId: string) {
  return useQuery({
    queryKey: reportsKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmReportDTO[]>(
        `/api/workspaces/${workspaceId}/crm/reports`,
        undefined,
        'Erro ao buscar relatórios',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmReport(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      source: 'company' | 'person' | 'opportunity' | 'lead'
      columns: string[]
    }) =>
      apiFetch<CrmReportDTO>(
        `/api/workspaces/${workspaceId}/crm/reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar relatório',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKey(workspaceId) })
    },
  })
}

export function useDeleteCrmReport(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reportId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/reports/${reportId}`,
        { method: 'DELETE' },
        'Erro ao remover relatório',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKey(workspaceId) })
    },
  })
}

export function useCrmReportData(workspaceId: string, reportId: string | null) {
  return useQuery({
    queryKey: ['crm-report-data', workspaceId, reportId],
    queryFn: () =>
      apiFetch<Record<string, unknown>[]>(
        `/api/workspaces/${workspaceId}/crm/reports/${reportId}/data`,
        undefined,
        'Erro ao carregar dados do relatório',
      ),
    enabled: !!workspaceId && !!reportId,
  })
}
