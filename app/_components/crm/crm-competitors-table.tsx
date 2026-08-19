'use client'

import { useMemo } from 'react'
import { CrmCompetitorMetricsPanel } from '@/app/_components/crm/crm-competitor-metrics-panel'
import { CrmCompetitorQuickAdd } from '@/app/_components/crm/crm-competitor-quick-add'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import { CRM_COMPETITOR_SYNCABLE_PLATFORMS } from '@/src/schemas/crm-competitor.schema'
import { CRM_SOCIAL_PLATFORM_LABELS } from '@/src/schemas/crm-social.schema'
import type { CrmCompetitorDTO } from '@/types/crm-competitor'

/**
 * Só Instagram/YouTube: são as únicas plataformas com autofill/sync
 * automático via API pública (ver `src/lib/social/discovery/`). As demais
 * não têm uma forma viável de descoberta pública de dados.
 */
const PLATFORMS = CRM_COMPETITOR_SYNCABLE_PLATFORMS
const PLATFORM_LABELS = CRM_SOCIAL_PLATFORM_LABELS

const COLUMNS: GridColumn[] = [
  {
    key: 'handle',
    header: 'Perfil',
    kind: 'text',
    required: true,
    primary: true,
    placeholder: '@concorrente',
  },
  {
    key: 'platform',
    header: 'Plataforma',
    kind: 'select',
    required: true,
    defaultValue: 'INSTAGRAM',
    options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] })),
  },
  { key: 'profileUrl', header: 'URL do perfil', kind: 'text' },
  { key: 'followersCount', header: 'Seguidores', kind: 'number' },
  { key: 'notes', header: 'Observações', kind: 'text' },
  {
    key: 'lastSyncedAt',
    header: 'Última sincronização',
    kind: 'readonly-date',
  },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

const LOOKUP_KINDS: LookupKind[] = []

export function CrmCompetitorsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmCompetitorDTO>(
    workspaceId,
    'competitors',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const columns = useMemo(() => COLUMNS, [])

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='flex justify-end'>
        <CrmCompetitorQuickAdd workspaceId={workspaceId} onAdded={refetch} />
      </div>
      <DataTable
        columns={columns}
        data={items}
        workspaceId={workspaceId}
        slug={slug}
        resource='competitors'
        createTitle='concorrente'
        lookups={lookups}
        isLoading={isLoading}
        searchPlaceholder='Buscar concorrentes…'
        refetch={refetch}
        renderRecordExtra={(record) => (
          <CrmCompetitorMetricsPanel
            workspaceId={workspaceId}
            competitorId={record.id}
          />
        )}
      />
    </div>
  )
}
