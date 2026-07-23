import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CrmCompanyDTO } from '@/types/crm-company'
import { apiFetch, apiSend } from './_fetch'

function companiesKey(workspaceId: string) {
  return ['crm-companies', workspaceId] as const
}

export function useCrmCompanies(workspaceId: string) {
  return useQuery({
    queryKey: companiesKey(workspaceId),
    queryFn: () =>
      apiFetch<CrmCompanyDTO[]>(
        `/api/workspaces/${workspaceId}/crm/companies`,
        undefined,
        'Erro ao buscar empresas',
      ),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateCrmCompany(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; domain?: string; icp?: boolean }) =>
      apiFetch<CrmCompanyDTO>(
        `/api/workspaces/${workspaceId}/crm/companies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar empresa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKey(workspaceId) })
    },
  })
}

export function useDeleteCrmCompany(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (companyId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/companies/${companyId}`,
        { method: 'DELETE' },
        'Erro ao remover empresa',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKey(workspaceId) })
    },
  })
}
