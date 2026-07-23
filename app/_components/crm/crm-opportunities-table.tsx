'use client'

import { useMemo } from 'react'
import { CrmOpportunityLineItems } from '@/app/_components/crm/crm-opportunity-line-items'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmOpportunityDTO } from '@/types/crm-opportunity'

const LOOKUP_KINDS: LookupKind[] = [
  'companies',
  'people',
  'users',
  'pipelines',
  'stages',
  'products',
]

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    required: true,
    primary: true,
    placeholder: 'Renovação anual — Acme',
  },
  { key: 'amount', header: 'Valor', kind: 'money', placeholder: '50000' },
  {
    key: 'pipelineId',
    header: 'Funil',
    kind: 'relation',
    relationKind: 'pipelines',
  },
  {
    key: 'stageId',
    header: 'Etapa',
    kind: 'relation',
    relationKind: 'stages',
  },
  { key: 'closeDate', header: 'Data de fechamento', kind: 'date' },
  {
    key: 'companyId',
    header: 'Empresa',
    kind: 'relation',
    relationKind: 'companies',
    clearable: true,
  },
  {
    key: 'pointOfContactId',
    header: 'Ponto de contato',
    kind: 'relation',
    relationKind: 'people',
    clearable: true,
  },
  {
    key: 'ownerId',
    header: 'Responsável',
    kind: 'relation',
    relationKind: 'users',
    clearable: true,
  },
  {
    key: 'createdById',
    header: 'Criado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  {
    key: 'updatedById',
    header: 'Atualizado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

export function CrmOpportunitiesTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmOpportunityDTO>(
    workspaceId,
    'opportunities',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)

  const columns = useMemo(() => COLUMNS, [])

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='opportunities'
      createTitle='oportunidade'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar oportunidades…'
      refetch={refetch}
      renderRecordExtra={(record) => (
        <CrmOpportunityLineItems
          workspaceId={workspaceId}
          opportunityId={record.id}
          productOptions={lookups.options.products}
          onChanged={refetch}
        />
      )}
    />
  )
}
