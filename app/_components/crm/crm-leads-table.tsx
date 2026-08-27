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

const LOOKUP_KINDS: LookupKind[] = ['users', 'companies']

export const LEAD_STATUSES: CrmLeadStatusDTO[] = [
  'NEW',
  'WORKING',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
]

export const STATUS_STYLES: Record<CrmLeadStatusDTO, string> = {
  NEW: 'bg-slate-500/15 text-slate-600',
  WORKING: 'bg-blue-500/15 text-blue-600',
  QUALIFIED: 'bg-emerald-500/15 text-emerald-600',
  UNQUALIFIED: 'bg-rose-500/15 text-rose-600',
  CONVERTED: 'bg-violet-500/15 text-violet-600',
}

export const STATUS_LABELS: Record<CrmLeadStatusDTO, string> = {
  NEW: 'Novo',
  WORKING: 'Em contato',
  QUALIFIED: 'Qualificado',
  UNQUALIFIED: 'Desqualificado',
  CONVERTED: 'Convertido',
}

/** Canal de entrada: categoria fixa, separada de `source` (texto livre para
 * detalhe/campanha específica dentro do canal). */
const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'SITE', label: 'Site' },
  { value: 'FORM', label: 'Formulário' },
  { value: 'INDICACAO', label: 'Indicação' },
  { value: 'EVENTO', label: 'Evento' },
  { value: 'OUTRO', label: 'Outro' },
]

const CHANNEL_STYLES: Record<string, string> = {
  WHATSAPP: 'bg-emerald-500/15 text-emerald-600',
  INSTAGRAM: 'bg-fuchsia-500/15 text-fuchsia-600',
  FACEBOOK: 'bg-blue-500/15 text-blue-600',
  SITE: 'bg-slate-500/15 text-slate-600',
  FORM: 'bg-violet-500/15 text-violet-600',
  INDICACAO: 'bg-amber-500/15 text-amber-600',
  EVENTO: 'bg-rose-500/15 text-rose-600',
  OUTRO: 'bg-muted text-muted-foreground',
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
  {
    key: 'company',
    header: 'Empresa',
    kind: 'company-name-picker',
    placeholder: 'Selecionar empresa',
  },
  { key: 'jobTitle', header: 'Cargo', kind: 'text' },
  { key: 'source', header: 'Origem', kind: 'text', placeholder: 'WhatsApp' },
  {
    key: 'channel',
    header: 'Canal de entrada',
    kind: 'select',
    options: CHANNEL_OPTIONS,
    optionStyles: CHANNEL_STYLES,
  },
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
      kanban={{
        groupByKey: 'status',
        columns: LEAD_STATUSES.map((s) => ({
          value: s,
          label: STATUS_LABELS[s],
          className: STATUS_STYLES[s],
        })),
        renderCard: (record) => (
          <div className='flex flex-col gap-1'>
            <span className='truncate font-medium'>{record.name}</span>
            {record.company ? (
              <span className='truncate text-muted-foreground text-xs'>
                {record.company}
              </span>
            ) : null}
            {record.emails[0] ? (
              <span className='truncate text-muted-foreground text-xs'>
                {record.emails[0]}
              </span>
            ) : null}
          </div>
        ),
      }}
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
