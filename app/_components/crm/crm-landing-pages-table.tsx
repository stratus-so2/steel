'use client'

import { useMemo } from 'react'
import { CrmLandingPageMetrics } from '@/app/_components/crm/crm-landing-page-metrics'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmLandingPageDTO } from '@/types/crm-landing-page'

const LOOKUP_KINDS: LookupKind[] = ['users']

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-600',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'title',
    header: 'Título',
    kind: 'text',
    required: true,
    primary: true,
    linkView: true,
    placeholder: 'Landing page',
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
    key: 'html',
    header: 'Conteúdo',
    kind: 'richtext',
    placeholder: 'HTML da página…',
  },
  { key: 'shareToken', header: 'Token público', kind: 'text', readonly: true },
  {
    key: 'viewsCount',
    header: 'Acessos',
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

export function CrmLandingPagesTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmLandingPageDTO>(
    workspaceId,
    'landing-pages',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const columns = useMemo(() => COLUMNS, [])

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='landing-pages'
      createTitle='página'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar páginas…'
      refetch={refetch}
      kanban={{
        groupByKey: 'status',
        columns: [
          { value: 'DRAFT', label: 'Offline', className: STATUS_STYLES.DRAFT },
          {
            value: 'PUBLISHED',
            label: 'Online',
            className: STATUS_STYLES.PUBLISHED,
          },
        ],
        renderCard: (record) => (
          <div className='flex flex-col gap-1'>
            <span className='truncate font-medium'>
              {record.title || 'Landing page'}
            </span>
            <span className='truncate text-muted-foreground text-xs'>
              {record.viewsCount} acesso(s)
            </span>
          </div>
        ),
      }}
      renderRecordExtra={(record) => (
        <CrmLandingPageMetrics workspaceId={workspaceId} pageId={record.id} />
      )}
    />
  )
}
