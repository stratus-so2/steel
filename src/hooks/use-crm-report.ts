import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmReportData,
  CrmReportQuery,
  CrmReportSource,
} from '@/src/schemas/crm-report.schema'
import type { CrmReportDTO } from '@/types/crm-report'
import { apiFetch, apiSend } from './_fetch'

function reportsKey(workspaceId: string, basePath: string) {
  return ['crm-reports', basePath, workspaceId] as const
}

function reportKey(workspaceId: string, reportId: string, basePath: string) {
  return ['crm-report', basePath, workspaceId, reportId] as const
}

function reportDataKey(
  workspaceId: string,
  reportId: string,
  basePath: string,
) {
  return ['crm-report-data', basePath, workspaceId, reportId] as const
}

export function useCrmReports(workspaceId: string, basePath = 'crm') {
  return useQuery({
    queryKey: reportsKey(workspaceId, basePath),
    queryFn: () =>
      apiFetch<CrmReportDTO[]>(
        `/api/workspaces/${workspaceId}/${basePath}/reports`,
        undefined,
        'Erro ao buscar relatórios',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCrmReport(
  workspaceId: string,
  reportId: string | null,
  basePath = 'crm',
) {
  return useQuery({
    queryKey: reportKey(workspaceId, reportId ?? '', basePath),
    queryFn: () =>
      apiFetch<CrmReportDTO>(
        `/api/workspaces/${workspaceId}/${basePath}/reports/${reportId}`,
        undefined,
        'Relatório não encontrado.',
      ),
    enabled: !!workspaceId && !!reportId,
  })
}

export function useCreateCrmReport(workspaceId: string, basePath = 'crm') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      source: CrmReportSource
      columns: string[]
    }) =>
      apiFetch<CrmReportDTO>(
        `/api/workspaces/${workspaceId}/${basePath}/reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar relatório',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reportsKey(workspaceId, basePath),
      })
    },
  })
}

export function useUpdateCrmReport(workspaceId: string, basePath = 'crm') {
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
        `/api/workspaces/${workspaceId}/${basePath}/reports/${reportId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
        'Erro ao salvar relatório',
      ),
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({
        queryKey: reportsKey(workspaceId, basePath),
      })
      queryClient.invalidateQueries({
        queryKey: reportKey(workspaceId, reportId, basePath),
      })
    },
  })
}

export function useDeleteCrmReport(workspaceId: string, basePath = 'crm') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reportId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/${basePath}/reports/${reportId}`,
        { method: 'DELETE' },
        'Erro ao remover relatório',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reportsKey(workspaceId, basePath),
      })
    },
  })
}

/** Dados processados do relatório (join/union + agrupamento), para o preview. */
export function useCrmReportData(
  workspaceId: string,
  reportId: string | null,
  basePath = 'crm',
) {
  return useQuery({
    queryKey: reportDataKey(workspaceId, reportId ?? '', basePath),
    queryFn: () =>
      apiFetch<CrmReportData>(
        `/api/workspaces/${workspaceId}/${basePath}/reports/${reportId}/data`,
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
  basePath = 'crm',
): string {
  return `/api/workspaces/${workspaceId}/${basePath}/reports/${reportId}/export?format=${format}`
}
