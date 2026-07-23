import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GridColumn } from '@/app/_components/crm/table/grid'
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

/**
 * Converte definições em `GridColumn`s dinâmicas. `key` é `cf_<defId>`
 * (leitura via DTO achatado); `customFieldId` roteia a escrita para o
 * objeto `customFields` no PATCH — ver `grid.tsx`/`record-panel.tsx`.
 */
export function customFieldColumns(
  fields: CrmCustomFieldDefinitionDTO[],
): GridColumn[] {
  return fields.map((f): GridColumn => {
    const base = {
      key: `cf_${f.id}`,
      customFieldId: f.id,
      header: f.label,
      required: f.required,
    }
    switch (f.type) {
      case 'NUMBER':
        return { ...base, kind: 'number' }
      case 'DATE':
        return { ...base, kind: 'date' }
      case 'BOOLEAN':
        return { ...base, kind: 'boolean' }
      case 'SELECT':
        return {
          ...base,
          kind: 'select',
          clearable: true,
          options: f.options.map((o) => ({ value: o, label: o })),
        }
      default:
        return { ...base, kind: 'text' }
    }
  })
}
