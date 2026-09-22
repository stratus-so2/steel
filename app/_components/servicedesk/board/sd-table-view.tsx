'use client'

import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { notify } from '@/lib/notify'
import { useBulkUpdateSdTickets } from '@/src/hooks/use-sd-tickets'
import type { SdAgentDTO, SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdTicketDTO, SdTicketTypeDTO } from '@/types/sd-ticket'
import { sdFormatCustomFieldValue } from '../custom-fields/sd-custom-fields-utils'
import { type SdColumn, SdDataTable } from '../table/sd-data-table'
import { SdOptionSelect } from '../ticket/sd-option-select'
import {
  SdLevelBadge,
  SdPhaseBadge,
  SdSlaChip,
  SdTypeBadge,
  SdUserAvatar,
  useSdNow,
} from '../ticket/sd-ticket-badges'
import {
  SD_CHANNEL_LABEL,
  sdFormatDateTime,
  sdPrimarySla,
  sdTicketHref,
} from '../ticket/sd-ticket-meta'
import {
  sdDepartmentOptions,
  sdScaleOptions,
  sdTypePhases,
} from '../ticket/sd-ticket-options'
import type { SdSortField } from './sd-board-state'

/** Colunas da tabela de chamados (inclui campos customizados `cf:<chave>`). */
export function sdTicketColumns({
  now,
  config,
  agents,
}: {
  now: Date
  config: SdConfigBootstrapDTO | undefined
  agents: SdAgentDTO[]
}): SdColumn<SdTicketDTO>[] {
  const custom: SdColumn<SdTicketDTO>[] = (config?.customFields ?? [])
    .filter((d) => d.entity === 'TICKET' && d.active)
    .sort((a, b) => a.position - b.position)
    .map((d) => ({
      id: `cf:${d.key}`,
      header: d.label,
      defaultHidden: true,
      cell: (t) => (
        <span className='truncate text-sm'>
          {sdFormatCustomFieldValue(d, t.customFields[d.key], agents)}
        </span>
      ),
    }))

  return [
    {
      id: 'code',
      header: 'Código',
      sortKey: 'number',
      hideable: false,
      className: 'w-28',
      cell: (t) => (
        <span className='font-mono text-muted-foreground text-xs'>
          {t.code}
        </span>
      ),
    },
    {
      id: 'title',
      header: 'Título',
      sortKey: 'title',
      hideable: false,
      className: 'min-w-64 max-w-md',
      cell: (t) => <span className='line-clamp-1 font-medium'>{t.title}</span>,
    },
    {
      id: 'type',
      header: 'Tipo',
      cell: (t) => <SdTypeBadge type={t.type} />,
    },
    {
      id: 'phase',
      header: 'Fase',
      cell: (t) => <SdPhaseBadge phase={t.phase} />,
    },
    {
      id: 'priority',
      header: 'Prioridade',
      sortKey: 'priority',
      cell: (t) => <SdLevelBadge level={t.priority} />,
    },
    {
      id: 'severity',
      header: 'Severidade',
      cell: (t) => <SdLevelBadge level={t.severity} />,
    },
    {
      id: 'sla',
      header: 'SLA',
      sortKey: 'resolutionDueAt',
      cell: (t) => <SdSlaChip live={sdPrimarySla(t.sla, now).live} compact />,
    },
    {
      id: 'assignee',
      header: 'Responsável',
      cell: (t) =>
        t.assignee ? (
          <span className='flex items-center gap-1.5'>
            <SdUserAvatar user={t.assignee} className='size-5' />
            <span className='truncate'>{t.assignee.name}</span>
          </span>
        ) : (
          <span className='text-muted-foreground text-xs italic'>
            Não atribuído
          </span>
        ),
    },
    {
      id: 'requester',
      header: 'Solicitante',
      defaultHidden: true,
      cell: (t) => t.requester?.name ?? '—',
    },
    {
      id: 'customer',
      header: 'Cliente',
      cell: (t) => t.customer?.tradeName ?? t.customer?.name ?? '—',
    },
    {
      id: 'company',
      header: 'Empresa',
      defaultHidden: true,
      cell: (t) => t.company?.tradeName ?? t.company?.name ?? '—',
    },
    {
      id: 'contact',
      header: 'Contato',
      defaultHidden: true,
      cell: (t) => t.contact?.name ?? '—',
    },
    {
      id: 'department',
      header: 'Departamento',
      cell: (t) => t.department?.name ?? '—',
    },
    {
      id: 'category',
      header: 'Categoria',
      defaultHidden: true,
      cell: (t) =>
        [t.category?.name, t.subcategory?.name, t.service?.name]
          .filter(Boolean)
          .join(' › ') || '—',
    },
    {
      id: 'classification',
      header: 'Classificação',
      defaultHidden: true,
      cell: (t) => t.classification?.name ?? '—',
    },
    {
      id: 'tags',
      header: 'Tags',
      defaultHidden: true,
      cell: (t) =>
        t.tags.length ? (
          <span className='flex flex-wrap gap-1'>
            {t.tags.map((tag) => (
              <span key={tag} className='rounded bg-muted px-1 text-[11px]'>
                #{tag}
              </span>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'channel',
      header: 'Canal',
      defaultHidden: true,
      cell: (t) => SD_CHANNEL_LABEL[t.channel],
    },
    {
      id: 'createdAt',
      header: 'Aberto em',
      sortKey: 'createdAt',
      cell: (t) => (
        <span className='text-xs tabular-nums'>
          {sdFormatDateTime(t.createdAt)}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Atualizado em',
      sortKey: 'lastActivityAt',
      defaultHidden: true,
      cell: (t) => (
        <span className='text-xs tabular-nums'>
          {sdFormatDateTime(t.lastActivityAt)}
        </span>
      ),
    },
    {
      id: 'resolutionDueAt',
      header: 'Prazo de resolução',
      sortKey: 'resolutionDueAt',
      defaultHidden: true,
      cell: (t) => (
        <span className='text-xs tabular-nums'>
          {sdFormatDateTime(t.resolutionDueAt)}
        </span>
      ),
    },
    ...custom,
  ]
}

type BulkField = 'assigneeId' | 'phaseId' | 'priorityId' | 'departmentId'

function BulkBar({
  workspaceId,
  selected,
  tickets,
  config,
  agents,
  onDone,
}: {
  workspaceId: string
  selected: string[]
  tickets: SdTicketDTO[]
  config: SdConfigBootstrapDTO | undefined
  agents: SdAgentDTO[]
  onDone: () => void
}) {
  const bulk = useBulkUpdateSdTickets(workspaceId)
  const types = new Set(
    tickets.filter((t) => selected.includes(t.id)).map((t) => t.type),
  )
  const singleType: SdTicketTypeDTO | null =
    types.size === 1 ? ([...types][0] ?? null) : null

  function apply(field: BulkField, value: string | null) {
    if (field === 'phaseId' && !value) return
    bulk.mutate(
      { ids: selected, [field]: value ?? null },
      {
        onSuccess: (result) => {
          if (result.failed.length === 0) {
            notify.success(
              `${result.updated.length} chamado${result.updated.length === 1 ? '' : 's'} atualizado${result.updated.length === 1 ? '' : 's'}.`,
            )
          } else {
            notify.warning(
              `${result.updated.length} atualizado(s), ${result.failed.length} recusado(s): ${result.failed[0]?.message ?? ''}`,
            )
          }
          onDone()
        },
        onError: notify.error,
      },
    )
  }

  return (
    <div
      role='toolbar'
      aria-label='Ações em massa'
      className='mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2'
    >
      <span className='font-medium text-sm tabular-nums'>
        {selected.length} selecionado{selected.length === 1 ? '' : 's'}
      </span>
      <div className='w-44'>
        <SdOptionSelect
          aria-label='Atribuir a'
          value={null}
          placeholder='Atribuir a…'
          noneLabel='Remover responsável'
          disabled={bulk.isPending}
          onChange={(v) => apply('assigneeId', v)}
          options={agents
            .filter((a) => a.isAgent)
            .map((a) => ({ value: a.id, label: a.name }))}
        />
      </div>
      <div className='w-44'>
        <SdOptionSelect
          aria-label='Mover para a fase'
          value={null}
          allowClear={false}
          placeholder={singleType ? 'Mover para…' : 'Fase (um tipo só)'}
          disabled={bulk.isPending || !singleType}
          onChange={(v) => apply('phaseId', v)}
          options={
            singleType
              ? sdTypePhases(config, singleType).map((p) => ({
                  value: p.id,
                  label: p.name,
                  color: p.color,
                }))
              : []
          }
        />
      </div>
      <div className='w-40'>
        <SdOptionSelect
          aria-label='Prioridade'
          value={null}
          placeholder='Prioridade…'
          noneLabel='Sem prioridade'
          disabled={bulk.isPending}
          onChange={(v) => apply('priorityId', v)}
          options={sdScaleOptions(config?.priorities ?? [])}
        />
      </div>
      <div className='w-44'>
        <SdOptionSelect
          aria-label='Departamento'
          value={null}
          placeholder='Departamento…'
          noneLabel='Sem departamento'
          disabled={bulk.isPending}
          onChange={(v) => apply('departmentId', v)}
          options={sdDepartmentOptions(config?.departments ?? [])}
        />
      </div>
      <Button variant='ghost' size='sm' className='ml-auto' onClick={onDone}>
        <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
        Limpar seleção
      </Button>
    </div>
  )
}

/** Tabela paginada no servidor com seleção múltipla e ações em massa. */
export function SdTableView({
  workspaceId,
  slug,
  tickets,
  total,
  page,
  pageSize,
  sort,
  order,
  loading,
  error,
  hiddenColumns,
  config,
  agents,
  onPageChange,
  onPageSizeChange,
  onSortChange,
}: {
  workspaceId: string
  slug: string
  tickets: SdTicketDTO[]
  total: number
  page: number
  pageSize: number
  sort: SdSortField
  order: 'asc' | 'desc'
  loading?: boolean
  error?: string | null
  hiddenColumns: string[]
  config: SdConfigBootstrapDTO | undefined
  agents: SdAgentDTO[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSortChange: (sort: SdSortField, order: 'asc' | 'desc') => void
}) {
  const router = useRouter()
  const now = useSdNow()
  const [selected, setSelected] = useState<string[]>([])
  const pageIds = tickets.map((t) => t.id)
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id))

  const selection: SdColumn<SdTicketDTO> = {
    id: 'select',
    header: 'Seleção',
    hideable: false,
    className: 'w-9',
    headerContent: (
      <Checkbox
        aria-label='Selecionar todos da página'
        checked={allSelected}
        onCheckedChange={(checked) =>
          setSelected((current) =>
            checked
              ? [...new Set([...current, ...pageIds])]
              : current.filter((id) => !pageIds.includes(id)),
          )
        }
      />
    ),
    cell: (t) => (
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`Selecionar ${t.code}`}
          checked={selected.includes(t.id)}
          onCheckedChange={(checked) =>
            setSelected((current) =>
              checked
                ? [...current, t.id]
                : current.filter((id) => id !== t.id),
            )
          }
        />
      </span>
    ),
  }

  const columns = [selection, ...sdTicketColumns({ now, config, agents })]

  return (
    <div className='flex h-full min-h-0 flex-col'>
      {selected.length > 0 ? (
        <BulkBar
          workspaceId={workspaceId}
          selected={selected}
          tickets={tickets}
          config={config}
          agents={agents}
          onDone={() => setSelected([])}
        />
      ) : null}
      <div className='min-h-0 flex-1'>
        <SdDataTable<SdTicketDTO>
          storageKey='sd-tickets'
          hideToolbar
          hiddenColumns={hiddenColumns}
          columns={columns}
          rows={tickets}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          sort={sort}
          order={order}
          onSortChange={(s, o) => onSortChange(s as SdSortField, o)}
          search=''
          onSearchChange={() => {}}
          isLoading={loading}
          error={error}
          onRowClick={(t) => router.push(sdTicketHref(slug, t))}
          rowClassName={(t) =>
            selected.includes(t.id) ? 'bg-primary/5' : undefined
          }
          emptyTitle='Nenhum chamado encontrado'
          emptyDescription='Ajuste os filtros ou abra um novo chamado.'
        />
      </div>
    </div>
  )
}
