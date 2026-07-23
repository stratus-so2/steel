'use client'

import { useMemo } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { useConvertCrmLead } from '@/src/hooks/use-crm-lead'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmLeadDTO, CrmLeadStatusDTO } from '@/types/crm-lead'

const LOOKUP_KINDS: LookupKind[] = ['users']

const LEAD_STATUSES: CrmLeadStatusDTO[] = [
  'NEW',
  'WORKING',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
]

const STATUS_STYLES: Record<CrmLeadStatusDTO, string> = {
  NEW: 'bg-slate-500/15 text-slate-600',
  WORKING: 'bg-blue-500/15 text-blue-600',
  QUALIFIED: 'bg-emerald-500/15 text-emerald-600',
  UNQUALIFIED: 'bg-rose-500/15 text-rose-600',
  CONVERTED: 'bg-violet-500/15 text-violet-600',
}

const STATUS_LABELS: Record<CrmLeadStatusDTO, string> = {
  NEW: 'Novo',
  WORKING: 'Em contato',
  QUALIFIED: 'Qualificado',
  UNQUALIFIED: 'Desqualificado',
  CONVERTED: 'Convertido',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    required: true,
    primary: true,
    placeholder: 'Maria Silva',
  },
  {
    key: 'emails',
    header: 'E-mails',
    kind: 'tags',
    placeholder: 'maria@x.com',
  },
  { key: 'phones', header: 'Telefones', kind: 'tags' },
  { key: 'company', header: 'Empresa', kind: 'text' },
  { key: 'jobTitle', header: 'Cargo', kind: 'text' },
  { key: 'source', header: 'Origem', kind: 'text', placeholder: 'WhatsApp' },
  {
    key: 'status',
    header: 'Status',
    kind: 'select',
    defaultValue: 'NEW',
    options: LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    optionStyles: STATUS_STYLES,
  },
  { key: 'score', header: 'Score', kind: 'number', readonly: true },
  {
    key: 'ownerId',
    header: 'Responsável',
    kind: 'relation',
    relationKind: 'users',
    clearable: true,
  },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
]

export function CrmLeadsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmLeadDTO>(
    workspaceId,
    'leads',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)

  const columns = useMemo(() => COLUMNS, [])

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='leads'
      createTitle='lead'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar leads…'
      refetch={refetch}
      renderRecordExtra={(record) => (
        <LeadConvert
          workspaceId={workspaceId}
          leadId={record.id}
          status={record.status}
          onConverted={refetch}
        />
      )}
    />
  )
}

function LeadConvert({
  workspaceId,
  leadId,
  status,
  onConverted,
}: {
  workspaceId: string
  leadId: string
  status: CrmLeadStatusDTO
  onConverted: () => void
}) {
  const convertLead = useConvertCrmLead(workspaceId)

  async function handleConvert() {
    try {
      await convertLead.mutateAsync(leadId)
      notify.success('Lead convertido em pessoa')
      onConverted()
    } catch (err) {
      notify.error(err)
    }
  }

  if (status === 'CONVERTED') {
    return (
      <p className='text-muted-foreground text-sm'>
        Este lead já foi convertido.
      </p>
    )
  }

  return (
    <Button
      size='sm'
      className='w-full'
      disabled={convertLead.isPending}
      onClick={handleConvert}
    >
      {convertLead.isPending ? 'Convertendo…' : 'Converter em pessoa'}
    </Button>
  )
}
