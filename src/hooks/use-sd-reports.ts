import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateSdScheduledReportDTO,
  GenerateSdReportDTO,
  UpdateSdScheduledReportDTO,
} from '@/src/schemas/sd-report.schema'
import type {
  SdReportFormatDTO,
  SdReportRunDTO,
  SdScheduledReportDTO,
} from '@/types/sd-report'
import { apiFetch, apiSend } from './_fetch'

/**
 * Relatórios de SLA agendados: a aba "Relatórios" das configurações. Leitura
 * de qualquer agente (`sd-reports:VIEW`); criar, editar, excluir e "gerar
 * agora" exigem admin do módulo.
 */

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/reports`

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

export const sdReportKeys = {
  all: (ws: string) => ['sd-reports', ws] as const,
  list: (ws: string, includeInactive: boolean) =>
    ['sd-reports', ws, 'list', includeInactive] as const,
  runs: (ws: string, reportId: string | null) =>
    ['sd-reports', ws, 'runs', reportId ?? 'all'] as const,
}

export function useSdScheduledReports(
  workspaceId: string,
  options: { includeInactive?: boolean; enabled?: boolean } = {},
) {
  const includeInactive = options.includeInactive ?? false
  return useQuery({
    queryKey: sdReportKeys.list(workspaceId, includeInactive),
    queryFn: () =>
      apiFetch<SdScheduledReportDTO[]>(
        includeInactive
          ? `${base(workspaceId)}?includeInactive=true`
          : base(workspaceId),
        undefined,
        'Erro ao carregar os relatórios agendados',
      ),
    enabled: Boolean(workspaceId) && options.enabled !== false,
  })
}

/** Histórico de execuções: do workspace ou de um agendamento. */
export function useSdReportRuns(
  workspaceId: string,
  reportId: string | null = null,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sdReportKeys.runs(workspaceId, reportId),
    queryFn: () =>
      apiFetch<SdReportRunDTO[]>(
        reportId
          ? `${base(workspaceId)}/runs?reportId=${encodeURIComponent(reportId)}`
          : `${base(workspaceId)}/runs`,
        undefined,
        'Erro ao carregar o histórico de relatórios',
      ),
    enabled: Boolean(workspaceId) && options.enabled !== false,
  })
}

function useInvalidateReports(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: sdReportKeys.all(workspaceId) })
}

export function useCreateSdScheduledReport(workspaceId: string) {
  const invalidate = useInvalidateReports(workspaceId)
  return useMutation({
    mutationFn: (input: CreateSdScheduledReportDTO) =>
      apiFetch<SdScheduledReportDTO>(
        base(workspaceId),
        json('POST', input),
        'Erro ao criar o relatório agendado',
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSdScheduledReport(workspaceId: string) {
  const invalidate = useInvalidateReports(workspaceId)
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateSdScheduledReportDTO
    }) =>
      apiFetch<SdScheduledReportDTO>(
        `${base(workspaceId)}/${id}`,
        json('PATCH', data),
        'Erro ao salvar o relatório agendado',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdScheduledReport(workspaceId: string) {
  const invalidate = useInvalidateReports(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${base(workspaceId)}/${id}`,
        { method: 'DELETE' },
        'Erro ao excluir o relatório agendado',
      ),
    onSuccess: invalidate,
  })
}

/** "Gerar agora": com `reportId` usa o agendamento; sem ele é sob demanda. */
export function useGenerateSdReport(workspaceId: string) {
  const invalidate = useInvalidateReports(workspaceId)
  return useMutation({
    mutationFn: (input: GenerateSdReportDTO) =>
      apiFetch<SdReportRunDTO>(
        `${base(workspaceId)}/runs`,
        json('POST', input),
        'Erro ao gerar o relatório',
      ),
    onSuccess: invalidate,
  })
}

/** URL autenticada do arquivo de uma execução (o download da tela). */
export function sdReportDownloadUrl(
  workspaceId: string,
  runId: string,
  format: SdReportFormatDTO,
): string {
  return `${base(workspaceId)}/runs/${runId}/download?format=${format}`
}
