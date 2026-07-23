import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrmCustomFieldDefinitionDTO,
  CrmCustomFieldEntityDTO,
  CrmCustomFieldTypeDTO,
} from '@/types/crm-custom-field'
import { apiFetch, apiSend } from './_fetch'

function customFieldsKey(workspaceId: string) {
  return ['crm-custom-fields', workspaceId] as const
}

export function useCrmCustomFields(
  workspaceId: string,
  entity?: CrmCustomFieldEntityDTO,
) {
  return useQuery({
    queryKey: [...customFieldsKey(workspaceId), entity],
    queryFn: () =>
      apiFetch<CrmCustomFieldDefinitionDTO[]>(
        `/api/workspaces/${workspaceId}/crm/custom-fields${
          entity ? `?entity=${entity}` : ''
        }`,
        undefined,
        'Erro ao buscar campos customizados',
      ),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  })
}

export function useCreateCrmCustomField(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      entity: CrmCustomFieldEntityDTO
      key: string
      label: string
      type?: CrmCustomFieldTypeDTO
    }) =>
      apiFetch<CrmCustomFieldDefinitionDTO>(
        `/api/workspaces/${workspaceId}/crm/custom-fields`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar campo customizado',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKey(workspaceId) })
    },
  })
}

export function useDeleteCrmCustomField(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (definitionId: string) =>
      apiSend(
        `/api/workspaces/${workspaceId}/crm/custom-fields/${definitionId}`,
        { method: 'DELETE' },
        'Erro ao remover campo customizado',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKey(workspaceId) })
    },
  })
}
