import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmDashboardDTO } from '@/types/crm-dashboard'
import { apiFetch, apiSend } from './_fetch'

/**
 * Painéis do ServiceDesk. O motor é o do CRM (`CrmDashboardService` com
 * `module = SERVICE_DESK`), exposto em
 * `/api/workspaces/<ws>/servicedesk/dashboards`; os widgets continuam nos
 * hooks de `use-crm-dashboard-widget` com `basePath = 'servicedesk'`.
 */

export const sdDashboardKeys = {
  all: (workspaceId: string) => ['sd-dashboards', workspaceId] as const,
  list: (workspaceId: string) =>
    ['sd-dashboards', workspaceId, 'list'] as const,
}

function base(workspaceId: string): string {
  return `/api/workspaces/${workspaceId}/servicedesk/dashboards`
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

export function useSdDashboards(workspaceId: string) {
  return useQuery({
    queryKey: sdDashboardKeys.list(workspaceId),
    queryFn: () =>
      apiFetch<CrmDashboardDTO[]>(
        base(workspaceId),
        undefined,
        'Erro ao carregar os painéis',
      ),
    enabled: Boolean(workspaceId),
    staleTime: 30 * 1000,
  })
}

function useInvalidateSdDashboards(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      queryKey: sdDashboardKeys.all(workspaceId),
    })
}

export function useCreateSdDashboard(workspaceId: string) {
  const invalidate = useInvalidateSdDashboards(workspaceId)
  return useMutation({
    mutationFn: (title: string) =>
      apiFetch<CrmDashboardDTO>(
        base(workspaceId),
        json('POST', { title }),
        'Erro ao criar o painel',
      ),
    onSuccess: invalidate,
  })
}

export function useRenameSdDashboard(workspaceId: string) {
  const invalidate = useInvalidateSdDashboards(workspaceId)
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetch<CrmDashboardDTO>(
        `${base(workspaceId)}/${id}`,
        json('PATCH', { title }),
        'Erro ao renomear o painel',
      ),
    onSuccess: invalidate,
  })
}

export function useDuplicateSdDashboard(workspaceId: string) {
  const invalidate = useInvalidateSdDashboards(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CrmDashboardDTO>(
        `${base(workspaceId)}/${id}/duplicate`,
        json('POST'),
        'Erro ao duplicar o painel',
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSdDashboard(workspaceId: string) {
  const invalidate = useInvalidateSdDashboards(workspaceId)
  return useMutation({
    mutationFn: (id: string) =>
      apiSend(
        `${base(workspaceId)}/${id}`,
        json('DELETE'),
        'Erro ao excluir o painel',
      ),
    onSuccess: invalidate,
  })
}
