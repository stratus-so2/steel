import '@tanstack/react-table'
import type { Lookups } from '@/src/hooks/use-crm-workspace-lookups'

declare module '@tanstack/react-table' {
  interface ColumnMeta<
    _TData extends import('@tanstack/react-table').RowData,
    _TValue,
  > {
    /** Tipo declarativo da coluna — define as opções de cálculo do rodapé. */
    kind?: import('@/app/_components/crm/table/grid').GridColumn['kind']
  }

  interface TableMeta<_TData extends import('@tanstack/react-table').RowData> {
    /** Contexto da grade editável (auto-save inline) do CRM. */
    grid?: {
      slug: string
      workspaceId: string
      /** Recurso da rota (ex.: "companies") — usado para links de visualização. */
      resource: string
      lookups: Lookups
      /** PATCH parcial de um campo de uma linha existente. */
      patch: (id: string, patch: Record<string, unknown>) => void
      /** Abre o painel lateral de detalhes/edição do registro. */
      openRecord: (id: string) => void
      /** id da linha recém-criada — entra em edição no campo primário. */
      newRowId: string | null
    }
  }
}
