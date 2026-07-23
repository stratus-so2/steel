import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmReportData,
  CrmReportQuery,
  CrmReportSource,
} from '@/src/schemas/crm-report.schema'
import type { CrmReportDTO } from '@/types/crm-report'
import { apiFetch, apiSend } from './_fetch'

function reportsKey(workspaceId: string) {
  return ['crm-reports', workspaceId] as const
}

function reportKey(workspaceId: string, reportId: string) {
  return ['crm-report', workspaceId, reportId] as const
}

function reportDataKey(workspaceId: string, reportId: string) {
  return ['crm-report-data', workspaceId, reportId] as const
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

export function useCrmReport(workspaceId: string, reportId: string | null) {
  return useQuery({
    queryKey: reportKey(workspaceId, reportId ?? ''),
    queryFn: () =>
      apiFetch<CrmReportDTO>(
        `/api/workspaces/${workspaceId}/crm/reports/${reportId}`,
        undefined,
        'Relatório não encontrado.',
      ),
    enabled: !!workspaceId && !!reportId,
  })
}

export function useCreateCrmReport(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      source: CrmReportSource
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

export function useUpdateCrmReport(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      reportId,
      patch,
    }: {
      reportId: string
      patch: { name?: string; query?: CrmReportQuery }
    }) =>
      apiFetch<CrmReportDTO>(
        `/api/workspaces/${workspaceId}/crm/reports/${reportId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
        'Erro ao salvar relatório',
      ),
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: reportsKey(workspaceId) })
      queryClient.invalidateQueries({
        queryKey: reportKey(workspaceId, reportId),
      })
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

/** Dados processados do relatório (join/union + agrupamento), para o preview. */
export function useCrmReportData(workspaceId: string, reportId: string | null) {
  return useQuery({
    queryKey: reportDataKey(workspaceId, reportId ?? ''),
    queryFn: () =>
      apiFetch<CrmReportData>(
        `/api/workspaces/${workspaceId}/crm/reports/${reportId}/data`,
        undefined,
        'Erro ao carregar dados do relatório',
      ),
    enabled: !!workspaceId && !!reportId,
  })
}

/** URL de download do export processado (csv|xlsx). */
export function crmReportExportUrl(
  workspaceId: string,
  reportId: string,
  format: 'csv' | 'xlsx',
): string {
  return `/api/workspaces/${workspaceId}/crm/reports/${reportId}/export?format=${format}`
}
