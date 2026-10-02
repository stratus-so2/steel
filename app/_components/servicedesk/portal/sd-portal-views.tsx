'use client'

import type { IconSvgElement } from '@hugeicons/react'
import {
  CheckmarkCircle02Icon,
  KanbanIcon,
  LayoutTable01Icon,
  LeftToRightListBulletIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SdPhaseCategoryDTO, SdTicketDTO } from '@/types/sd-ticket'
import { type SdColumn, SdDataTable } from '../table/sd-data-table'
import { sdLocalTable } from '../table/sd-local-table'
import { useSdTableState } from '../table/use-sd-table-state'
import {
  SdPhaseBadge,
  SdProgressBar,
  SdTypeBadge,
} from '../ticket/sd-ticket-badges'
import {
  SD_BOARD_CATEGORIES,
  SD_PHASE_CATEGORY_COLOR,
  SD_PHASE_CATEGORY_LABEL,
  sdFormatDateTime,
  sdRelativeTime,
} from '../ticket/sd-ticket-meta'
import { SdPortalTicketRow, sdPortalTicketHref } from './sd-portal-ticket-row'
import { SD_PORTAL_OK_TONE } from './sd-portal-tone'

/**
 * The three views of "Meus chamados" in the requester portal — kanban, list
 * and table — matching what the agent boards already offer.
 *
 * They are built here instead of reusing `SdKanbanView`/`SdListView`/
 * `SdTableView` because those are agent surfaces: the kanban needs
 * `config.phases` to build its columns and takes a required `onMove` (a
 * requester must not drag a ticket into another phase), the table needs
 * `config` plus `agents` and carries bulk editing, and both link to the agent
 * route. The portal viewer has neither config nor agents.
 *
 * What makes a portal kanban possible without config is `phase.category` on
 * the ticket DTO: the columns are the six ITIL categories, which exist no
 * matter how the workspace named its phases — so this view also works on a
 * workspace whose flows were never configured.
 */

export type SdPortalView = 'kanban' | 'list' | 'table'

export const SD_PORTAL_VIEWS: {
  id: SdPortalView
  label: string
  icon: IconSvgElement
}[] = [
  { id: 'list', label: 'Lista', icon: LeftToRightListBulletIcon },
  { id: 'kanban', label: 'Kanban', icon: KanbanIcon },
  { id: 'table', label: 'Tabela', icon: LayoutTable01Icon },
]

/** View switch in the same markup the CRM grids and the boards use. */
export function SdPortalViewSwitch({
  value,
  onChange,
}: {
  value: SdPortalView
  onChange: (view: SdPortalView) => void
}) {
  return (
    <fieldset
      aria-label='Modo de exibição'
      className='flex items-center gap-0.5 rounded-md border p-0.5'
    >
      {SD_PORTAL_VIEWS.map((view) => (
        <Button
          key={view.id}
          type='button'
          variant={value === view.id ? 'secondary' : 'ghost'}
          size='icon-sm'
          aria-pressed={value === view.id}
          aria-label={view.label}
          title={view.label}
          onClick={() => onChange(view.id)}
        >
          <SteelIcon icon={view.icon} strokeWidth={2} />
        </Button>
      ))}
    </fieldset>
  )
}

/** Groups by phase category; CANCELED joins CLOSED, as on the agent board. */
export function sdPortalColumns(tickets: SdTicketDTO[]) {
  const bucket = (category: SdPhaseCategoryDTO) =>
    category === 'CANCELED' ? 'CLOSED' : category
  return SD_BOARD_CATEGORIES.map((category) => ({
    category,
    label: SD_PHASE_CATEGORY_LABEL[category],
    color: SD_PHASE_CATEGORY_COLOR[category],
    items: tickets.filter((t) => bucket(t.phase.category) === category),
  }))
}

export function SdPortalKanban({
  slug,
  tickets,
}: {
  slug: string
  tickets: SdTicketDTO[]
}) {
  return (
    <div className='flex gap-3 overflow-x-auto pb-2'>
      {sdPortalColumns(tickets).map((column) => (
        <section
          key={column.category}
          aria-label={column.label}
          className='flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-card/40 p-2'
        >
          <header className='flex items-center gap-2 px-1'>
            <span
              aria-hidden
              className='size-2 shrink-0 rounded-full'
              style={{ backgroundColor: column.color }}
            />
            <h3 className='min-w-0 flex-1 truncate font-medium text-sm'>
              {column.label}
            </h3>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {column.items.length}
            </span>
          </header>
          {column.items.length === 0 ? (
            <p className='py-6 text-center text-muted-foreground text-xs'>
              Nenhum chamado
            </p>
          ) : (
            <ul className='flex flex-col gap-2'>
              {column.items.map((ticket) => (
                <SdPortalTicketRow
                  key={ticket.id}
                  slug={slug}
                  ticket={ticket}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

/**
 * The portal list: open tickets first, finished ones folded away. This is the
 * layout the portal always had, kept as the default view — a requester with
 * three tickets is better served by it than by a grid.
 */
export function SdPortalList({
  slug,
  open,
  done,
}: {
  slug: string
  open: SdTicketDTO[]
  done: SdTicketDTO[]
}) {
  return (
    <div className='flex flex-col gap-4'>
      {open.length > 0 ? (
        <ul className='flex flex-col gap-2'>
          {open.map((ticket) => (
            <SdPortalTicketRow key={ticket.id} slug={slug} ticket={ticket} />
          ))}
        </ul>
      ) : (
        <p
          className={cn(
            'flex items-center gap-2 rounded-lg border p-3 text-sm',
            SD_PORTAL_OK_TONE,
          )}
        >
          <SteelIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
          Nenhum chamado em aberto. Tudo resolvido!
        </p>
      )}

      {done.length > 0 ? (
        <details className='rounded-xl border border-border bg-card p-3'>
          <summary className='cursor-pointer font-medium text-muted-foreground text-xs'>
            Chamados encerrados ({done.length})
          </summary>
          <ul className='mt-3 flex flex-col gap-2'>
            {done.map((ticket) => (
              <SdPortalTicketRow key={ticket.id} slug={slug} ticket={ticket} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

/** Requester-safe columns: no SLA, no assignee, no department. */
function portalColumns(): SdColumn<SdTicketDTO>[] {
  return [
    {
      id: 'code',
      header: 'Número',
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
      header: 'Pedido',
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
      header: 'Situação',
      cell: (t) => <SdPhaseBadge phase={t.phase} />,
    },
    {
      id: 'progress',
      header: 'Andamento',
      sortKey: 'progress',
      className: 'w-40',
      cell: (t) => (
        <span className='flex items-center gap-2'>
          <SdProgressBar
            percent={t.completionPercent}
            color={t.phase.color}
            className='w-20'
          />
          <span className='text-muted-foreground text-xs tabular-nums'>
            {t.completionPercent}%
          </span>
        </span>
      ),
    },
    {
      id: 'lastActivityAt',
      header: 'Atualizado',
      sortKey: 'lastActivityAt',
      cell: (t) => (
        <span className='text-xs'>{sdRelativeTime(t.lastActivityAt)}</span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Aberto em',
      sortKey: 'createdAt',
      defaultHidden: true,
      cell: (t) => (
        <span className='text-xs tabular-nums'>
          {sdFormatDateTime(t.createdAt)}
        </span>
      ),
    },
  ]
}

function portalSortValue(ticket: SdTicketDTO, sort: string) {
  switch (sort) {
    case 'code':
      return ticket.number
    case 'title':
      return ticket.title
    case 'progress':
      return ticket.completionPercent
    case 'createdAt':
      return ticket.createdAt
    default:
      return ticket.lastActivityAt
  }
}

export function SdPortalTable({
  slug,
  tickets,
  isLoading,
  error,
}: {
  slug: string
  tickets: SdTicketDTO[]
  isLoading?: boolean
  error?: string | null
}) {
  const router = useRouter()
  const table = useSdTableState({
    sort: 'lastActivityAt',
    order: 'desc',
    pageSize: 10,
    filters: {},
  })
  const slice = sdLocalTable(tickets, {
    q: table.q,
    searchText: (t) => `${t.code} ${t.title}`,
    sort: table.sort,
    order: table.order,
    sortValue: portalSortValue,
    page: table.page,
    pageSize: table.pageSize,
  })

  return (
    <div className='h-[32rem]'>
      <SdDataTable
        storageKey='portal-tickets'
        columns={portalColumns()}
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
        searchPlaceholder='Número ou assunto do pedido…'
        isLoading={isLoading}
        error={error ?? null}
        onRowClick={(row) => router.push(sdPortalTicketHref(slug, row.number))}
        emptyTitle='Nenhum chamado por aqui'
        emptyDescription='Quando você abrir um pedido, ele aparece nesta tabela.'
      />
    </div>
  )
}
