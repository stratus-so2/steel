'use client'

import { useMemo } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmDocumentTypeDTO, CrmProposalDTO } from '@/types/crm-proposal'

const LOOKUP_KINDS: LookupKind[] = ['users']

const DOCUMENT_TYPES: CrmDocumentTypeDTO[] = [
  'PROPOSAL',
  'PREMISES',
  'PORTFOLIO',
  'CONTRACT',
]

const TYPE_LABEL: Record<CrmDocumentTypeDTO, string> = {
  PROPOSAL: 'Proposta',
  PREMISES: 'Escopo',
  PORTFOLIO: 'Portfólio',
  CONTRACT: 'Contrato',
}

const TYPE_STYLES: Record<CrmDocumentTypeDTO, string> = {
  PREMISES: 'bg-amber-500/15 text-amber-600',
  PORTFOLIO: 'bg-violet-500/15 text-violet-600',
  PROPOSAL: 'bg-teal-500/15 text-teal-600',
  CONTRACT: 'bg-blue-500/15 text-blue-600',
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-600',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'title',
    header: 'Título',
    kind: 'text',
    primary: true,
    placeholder: 'Documento sem título',
  },
  {
    key: 'type',
    header: 'Tipo',
    kind: 'select',
    defaultValue: 'PROPOSAL',
    options: DOCUMENT_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
    optionStyles: TYPE_STYLES,
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'select',
    defaultValue: 'DRAFT',
    options: [
      { value: 'DRAFT', label: 'Offline' },
      { value: 'PUBLISHED', label: 'Online' },
    ],
    optionStyles: STATUS_STYLES,
  },
  {
    key: 'content',
    header: 'Conteúdo',
    kind: 'richtext',
    placeholder: 'Conteúdo do documento…',
  },
  {
    key: 'viewsCount',
    header: 'Visualizações',
    kind: 'number',
    readonly: true,
  },
  {
    key: 'createdById',
    header: 'Criado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  { key: 'createdAt', header: 'Data de criação', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

export function CrmProposalsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmProposalDTO>(
    workspaceId,
    'proposals',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const columns = useMemo(() => COLUMNS, [])

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='proposals'
      createTitle='documento'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar documentos…'
      refetch={refetch}
    />
  )
}
