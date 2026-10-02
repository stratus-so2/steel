'use client'

import {
  Bug01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSdAgents, useSdConfig } from '@/src/hooks/use-sd-config'
import {
  useDismissSdIncidentCluster,
  useOpenSdClusterProblem,
  useSdIncidentClusters,
} from '@/src/hooks/use-sd-risk'
import type { SdIncidentClusterDTO } from '@/types/sd-risk'
import {
  type SdColumn,
  SdDataTable,
  SdFilterField,
  SdFilterSelect,
} from '../table/sd-data-table'
import { sdLocalTable } from '../table/sd-local-table'
import { useSdTableState } from '../table/use-sd-table-state'
import { SdOptionSelect } from '../ticket/sd-option-select'
import {
  SD_TONE_TEXT,
  sdFormatDateTime,
  sdRelativeTime,
} from '../ticket/sd-ticket-meta'
import { sdDepartmentOptions } from '../ticket/sd-ticket-options'
import { SD_RISK_TONE } from './sd-risk-badge'

/**
 * Problem suggestions: similar incidents grouped by the worker
 * (`scan-clusters`). Opening the problem is an **agent action** — the analysis
 * never opens anything on its own (ADR 0016).
 *
 * This went from a stack of cards, each with a nested incident list, to the
 * **standard table** (`SdDataTable`). A group's incidents do not fit in a cell
 * and `SdDataTable` has no row expansion, so they moved into a dialog opened
 * by clicking the row — the same gesture the directory screens use to open a
 * record.
 */

/**
 * The "problem already opened" confirmation. The theme has no success token,
 * so the colour lives in this constant (the repository's convention, legible
 * in both themes) instead of loose in the JSX.
 */
const DONE_TONE = SD_TONE_TEXT.emerald

const STATUSES = [
  { value: 'open' as const, label: 'Em aberto' },
  { value: 'handled' as const, label: 'Tratadas' },
  { value: 'all' as const, label: 'Todas' },
]

function ClusterTickets({
  cluster,
  slug,
}: {
  cluster: SdIncidentClusterDTO
  slug: string
}) {
  return (
    <ul className='flex flex-col divide-y rounded-lg border bg-background'>
      {cluster.tickets.map((ticket) => (
        <li
          key={ticket.id}
          className='flex min-w-0 items-center gap-2 px-2.5 py-1.5 text-sm'
        >
          <Link
            href={`/${slug}/servicedesk/tickets/${ticket.number}`}
            className='w-24 shrink-0 font-mono text-muted-foreground text-xs hover:text-foreground hover:underline'
          >
            {ticket.code}
          </Link>
          <span className='min-w-0 flex-1 truncate'>{ticket.title}</span>
          <span className='hidden shrink-0 text-muted-foreground text-xs sm:inline'>
            {ticket.phase.name}
          </span>
          <span className='shrink-0 text-muted-foreground text-xs tabular-nums'>
            {sdFormatDateTime(ticket.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Group record: the incidents that landed in it and what was decided. */
function ClusterDetailDialog({
  cluster,
  slug,
  open,
  onOpenChange,
}: {
  cluster: SdIncidentClusterDTO
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='truncate'>{cluster.title}</DialogTitle>
          <DialogDescription>
            {cluster.ticketCount} incidentes com a mesma assinatura, o primeiro
            em {sdFormatDateTime(cluster.firstSeenAt)} e o último{' '}
            {sdRelativeTime(cluster.lastSeenAt)}.
          </DialogDescription>
        </DialogHeader>
        <ClusterTickets cluster={cluster} slug={slug} />
      </DialogContent>
    </Dialog>
  )
}

function OpenProblemDialog({
  workspaceId,
  cluster,
  open,
  onOpenChange,
}: {
  workspaceId: string
  cluster: SdIncidentClusterDTO
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: config } = useSdConfig(workspaceId)
  const { data: agents } = useSdAgents(workspaceId)
  const openProblem = useOpenSdClusterProblem(workspaceId)
  const [title, setTitle] = useState(cluster.title)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)

  function submit() {
    openProblem.mutate(
      {
        clusterId: cluster.id,
        title: title.trim() || undefined,
        departmentId: departmentId ?? undefined,
        assigneeId: assigneeId ?? undefined,
      },
      {
        onSuccess: (saved) => {
          onOpenChange(false)
          notify.success(
            `Problema ${saved.problemTicket?.code ?? ''} aberto com ${saved.ticketCount} incidentes vinculados.`,
          )
        },
        onError: notify.error,
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Abrir problema</DialogTitle>
          <DialogDescription>
            O problema nasce com os {cluster.ticketCount} incidentes do grupo na
            descrição; os que ainda não têm pai ficam vinculados como filhos.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sd-problem-title'>Título</Label>
            <Input
              id='sd-problem-title'
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sd-problem-department'>Departamento</Label>
            <SdOptionSelect
              id='sd-problem-department'
              aria-label='Departamento do problema'
              value={departmentId}
              onChange={setDepartmentId}
              options={sdDepartmentOptions(
                config?.departments ?? [],
                departmentId,
              )}
              placeholder='Pelo roteamento do catálogo'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sd-problem-assignee'>Responsável</Label>
            <SdOptionSelect
              id='sd-problem-assignee'
              aria-label='Responsável pelo problema'
              value={assigneeId}
              onChange={setAssigneeId}
              options={(agents ?? []).map((agent) => ({
                value: agent.id,
                label: agent.name,
              }))}
              placeholder='Sem responsável'
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button size='sm' onClick={submit} disabled={openProblem.isPending}>
            <SteelIcon icon={Bug01Icon} strokeWidth={2} />
            {openProblem.isPending ? 'Abrindo…' : 'Abrir problema'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The dismiss and open-problem buttons — only on an untreated group. */
function ClusterActions({
  workspaceId,
  cluster,
  onOpenProblem,
}: {
  workspaceId: string
  cluster: SdIncidentClusterDTO
  onOpenProblem: () => void
}) {
  const dismiss = useDismissSdIncidentCluster(workspaceId)
  return (
    <span className='flex items-center justify-end gap-1'>
      <Button
        variant='ghost'
        size='xs'
        disabled={dismiss.isPending}
        onClick={() =>
          dismiss.mutate(cluster.id, {
            onSuccess: () => notify.success('Sugestão descartada.'),
            onError: notify.error,
          })
        }
      >
        <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
        Descartar
      </Button>
      <Button size='xs' onClick={onOpenProblem}>
        <SteelIcon icon={Bug01Icon} strokeWidth={2} />
        Abrir problema
      </Button>
    </span>
  )
}

function clusterColumns({
  workspaceId,
  slug,
  onOpenProblem,
}: {
  workspaceId: string
  slug: string
  onOpenProblem: (cluster: SdIncidentClusterDTO) => void
}): SdColumn<SdIncidentClusterDTO>[] {
  return [
    {
      id: 'ticketCount',
      header: 'Incidentes',
      sortKey: 'ticketCount',
      hideable: false,
      className: 'w-32',
      cell: (cluster) => (
        // A repeated group is a warning sign: it reuses the risk badge's
        // medium band instead of spreading a new colour around.
        <span
          className={cn(
            'inline-flex h-5 items-center gap-1 rounded-md border px-1.5 font-medium text-[11px] tabular-nums',
            SD_RISK_TONE.MEDIUM,
          )}
        >
          <SteelIcon icon={Bug01Icon} strokeWidth={2} className='size-3' />
          {cluster.ticketCount} incidentes
        </span>
      ),
    },
    {
      id: 'title',
      header: 'Assinatura',
      sortKey: 'title',
      hideable: false,
      className: 'min-w-64 max-w-md',
      cell: (cluster) => (
        <span className='line-clamp-1 font-medium'>{cluster.title}</span>
      ),
    },
    {
      id: 'lastSeenAt',
      header: 'Última ocorrência',
      sortKey: 'lastSeenAt',
      cell: (cluster) => (
        <span className='text-muted-foreground text-xs'>
          {sdRelativeTime(cluster.lastSeenAt)}
        </span>
      ),
    },
    {
      id: 'firstSeenAt',
      header: 'Primeira ocorrência',
      sortKey: 'firstSeenAt',
      defaultHidden: true,
      cell: (cluster) => (
        <span className='text-xs tabular-nums'>
          {sdFormatDateTime(cluster.firstSeenAt)}
        </span>
      ),
    },
    {
      id: 'outcome',
      header: 'Situação',
      className: 'min-w-56',
      cell: (cluster) =>
        cluster.problemTicket ? (
          <span className={cn('flex items-center gap-1.5 text-xs', DONE_TONE)}>
            <SteelIcon
              icon={CheckmarkCircle02Icon}
              strokeWidth={2}
              className='size-3.5'
            />
            Problema{' '}
            <Link
              href={`/${slug}/servicedesk/tickets/${cluster.problemTicket.number}`}
              className='font-medium font-mono hover:underline'
            >
              {cluster.problemTicket.code}
            </Link>{' '}
            aberto a partir deste grupo.
          </span>
        ) : cluster.dismissedAt ? (
          <span className='text-muted-foreground text-xs'>
            Descartado por {cluster.dismissedBy?.name ?? 'alguém da equipe'} em{' '}
            {sdFormatDateTime(cluster.dismissedAt)}.
          </span>
        ) : (
          <span className='text-muted-foreground text-xs'>
            Aguardando decisão do agente.
          </span>
        ),
    },
    {
      id: 'actions',
      header: 'Ações',
      hideable: false,
      className: 'w-56 text-right',
      cell: (cluster) =>
        cluster.problemTicket || cluster.dismissedAt ? null : (
          <ClusterActions
            workspaceId={workspaceId}
            cluster={cluster}
            onOpenProblem={() => onOpenProblem(cluster)}
          />
        ),
    },
  ]
}

function clusterSortValue(cluster: SdIncidentClusterDTO, sort: string) {
  switch (sort) {
    case 'ticketCount':
      return cluster.ticketCount
    case 'title':
      return cluster.title
    case 'firstSeenAt':
      return cluster.firstSeenAt
    default:
      return cluster.lastSeenAt
  }
}

export function SdIncidentClusters({
  workspaceId,
  slug,
  status = 'open',
}: {
  workspaceId: string
  slug: string
  status?: 'open' | 'handled' | 'all'
}) {
  const table = useSdTableState({
    sort: 'lastSeenAt',
    order: 'desc',
    filters: { status: status as 'open' | 'handled' | 'all' | '' },
  })
  const effectiveStatus = (table.filters.status || status) as
    | 'open'
    | 'handled'
    | 'all'
  const { data, isLoading, error } = useSdIncidentClusters(workspaceId, {
    status: effectiveStatus,
  })
  const [opening, setOpening] = useState<SdIncidentClusterDTO | null>(null)
  const [detail, setDetail] = useState<SdIncidentClusterDTO | null>(null)

  const slice = sdLocalTable(data ?? [], {
    q: table.q,
    searchText: (cluster) =>
      `${cluster.title} ${cluster.tickets.map((t) => t.code).join(' ')}`,
    sort: table.sort,
    order: table.order,
    sortValue: clusterSortValue,
    page: table.page,
    pageSize: table.pageSize,
  })

  return (
    <>
      <SdDataTable
        storageKey='incident-clusters'
        columns={clusterColumns({
          workspaceId,
          slug,
          onOpenProblem: setOpening,
        })}
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
        searchPlaceholder='Assinatura ou código do incidente…'
        isLoading={isLoading}
        error={error ? error.message : null}
        onRowClick={setDetail}
        activeFilterCount={table.activeFilterCount}
        onClearFilters={table.clearFilters}
        filters={
          <SdFilterField label='Situação'>
            <SdFilterSelect
              value={table.filters.status}
              onChange={(value) => table.setFilter('status', value)}
              options={STATUSES}
              allLabel={
                STATUSES.find((option) => option.value === status)?.label ??
                'Em aberto'
              }
            />
          </SdFilterField>
        }
        emptyTitle='Nenhum incidente repetido'
        emptyDescription='A análise agrupa incidentes parecidos dos últimos 7 dias a partir de três ocorrências com a mesma assinatura.'
      />

      {detail ? (
        <ClusterDetailDialog
          cluster={detail}
          slug={slug}
          open
          onOpenChange={(open) => !open && setDetail(null)}
        />
      ) : null}
      {opening ? (
        <OpenProblemDialog
          workspaceId={workspaceId}
          cluster={opening}
          open
          onOpenChange={(open) => !open && setOpening(null)}
        />
      ) : null}
    </>
  )
}
