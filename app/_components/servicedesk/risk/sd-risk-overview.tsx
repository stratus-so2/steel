'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { useSdRiskTickets } from '@/src/hooks/use-sd-risk'
import { SD_RISK_LEVEL_LABEL } from '@/src/lib/servicedesk/risk'
import type { SdRiskLevelDTO } from '@/types/sd-risk'
import type { SdTicketDTO } from '@/types/sd-ticket'
import {
  type SdColumn,
  SdDataTable,
  SdFilterField,
  SdFilterSelect,
} from '../table/sd-data-table'
import { useSdTableState } from '../table/use-sd-table-state'
import {
  SdLevelBadge,
  SdPhaseBadge,
  SdSlaChip,
  SdTypeBadge,
  SdUserAvatar,
  useSdNow,
} from '../ticket/sd-ticket-badges'
import {
  sdFormatDateTime,
  sdPrimarySla,
  sdTicketHref,
} from '../ticket/sd-ticket-meta'
import { SdRiskBadge } from './sd-risk-badge'
import { sdLocalTable } from './sd-risk-table'

/**
 * Fila de chamados por risco na **tabela padrão** do módulo (`SdDataTable`,
 * a mesma de clientes, empresas e itens de configuração), em vez do layout
 * próprio que a tela tinha: três pílulas de faixa acima de uma lista de
 * linhas sem cabeçalho, sem ordenação, sem busca e sem colunas.
 *
 * A faixa de risco virou um campo do popover "Filtrar" — é o mesmo parâmetro
 * `level` que a rota já aceitava.
 */

const LEVELS: SdRiskLevelDTO[] = ['HIGH', 'MEDIUM', 'LOW']

function riskColumns(now: Date, slug: string): SdColumn<SdTicketDTO>[] {
  return [
    {
      id: 'code',
      header: 'Código',
      sortKey: 'code',
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
      cell: (t) => (
        <Link
          href={sdTicketHref(slug, t)}
          className='line-clamp-1 font-medium hover:underline'
        >
          {t.title}
        </Link>
      ),
    },
    {
      id: 'risk',
      header: 'Risco',
      sortKey: 'risk',
      cell: (t) =>
        t.risk ? (
          <SdRiskBadge risk={t.risk} showLow />
        ) : (
          <span className='text-muted-foreground text-xs'>—</span>
        ),
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
      id: 'department',
      header: 'Departamento',
      defaultHidden: true,
      cell: (t) => t.department?.name ?? '—',
    },
    {
      id: 'customer',
      header: 'Cliente',
      defaultHidden: true,
      cell: (t) => t.customer?.tradeName ?? t.customer?.name ?? '—',
    },
    {
      id: 'lastActivityAt',
      header: 'Última atividade',
      sortKey: 'lastActivityAt',
      cell: (t) => (
        <span className='text-xs tabular-nums'>
          {sdFormatDateTime(t.lastActivityAt)}
        </span>
      ),
    },
  ]
}

function riskSortValue(ticket: SdTicketDTO, sort: string) {
  switch (sort) {
    case 'code':
      return ticket.number
    case 'title':
      return ticket.title
    case 'risk':
      return ticket.risk?.score ?? null
    case 'priority':
      return ticket.priority?.level ?? null
    case 'resolutionDueAt':
      return ticket.resolutionDueAt ?? null
    default:
      return ticket.lastActivityAt
  }
}

export function SdRiskQueue({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const now = useSdNow()
  const table = useSdTableState({
    sort: 'risk',
    order: 'desc',
    filters: { level: 'HIGH' as SdRiskLevelDTO | '' },
  })
  const level = (table.filters.level || 'HIGH') as SdRiskLevelDTO
  const { data, isLoading, error } = useSdRiskTickets(workspaceId, { level })

  const slice = sdLocalTable(data ?? [], {
    q: table.q,
    searchText: (t) => `${t.code} ${t.title} ${t.assignee?.name ?? ''}`,
    sort: table.sort,
    order: table.order,
    sortValue: riskSortValue,
    page: table.page,
    pageSize: table.pageSize,
  })

  return (
    <SdDataTable
      storageKey='risk-queue'
      columns={riskColumns(now, slug)}
      rows={slice.rows}
      total={slice.total}
      page={slice.page}
      pageSize={table.pageSize}
      onPageChange={table.setPage}
      onPageSizeChange={table.setPageSize}
      sort={table.sort}
      order={table.order}
      onSortChange={table.setSort}
      search={table.search}
      onSearchChange={table.setSearch}
      searchPlaceholder='Código, título ou responsável…'
      isLoading={isLoading}
      error={error ? error.message : null}
      onRowClick={(row) => router.push(sdTicketHref(slug, row))}
      activeFilterCount={table.activeFilterCount}
      onClearFilters={table.clearFilters}
      filters={
        <SdFilterField label='Faixa de risco'>
          <SdFilterSelect
            value={table.filters.level}
            onChange={(value) => table.setFilter('level', value)}
            options={LEVELS.map((option) => ({
              value: option,
              label: SD_RISK_LEVEL_LABEL[option],
            }))}
            allLabel='Risco alto'
          />
        </SdFilterField>
      }
      actions={
        <Link
          href={`/${slug}/servicedesk/tickets?riskLevel=${level}&mode=list`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Ver no quadro
        </Link>
      }
      emptyTitle={`Nenhum chamado em ${SD_RISK_LEVEL_LABEL[level].toLowerCase()}`}
      emptyDescription='A previsão é recalculada a cada 10 minutos sobre os chamados abertos.'
    />
  )
}
