'use client'

import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { WorkspaceStatus } from '@prisma/client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { AdminWorkspaceSummaryDTO } from '@/types/admin-workspace'
import { PLAN_LABEL } from '../shell/admin-labels'
import {
  AdminPanel,
  DENSE_TABLE,
  EmptyState,
  formatDate,
  formatNumber,
  MonoId,
  WorkspaceStatusPill,
} from '../shell/admin-ui'

type StatusFilter = 'ALL' | WorkspaceStatus

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'SUSPENDED', label: 'Suspensos' },
  { value: 'DELETING', label: 'Em exclusão' },
]

/** Busca por nome, slug ou id — sem acento/caixa. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function AdminWorkspacesTable({
  workspaces,
}: {
  workspaces: AdminWorkspaceSummaryDTO[]
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')

  const counts = useMemo(() => {
    const byStatus: Record<StatusFilter, number> = {
      ALL: workspaces.length,
      ACTIVE: 0,
      SUSPENDED: 0,
      DELETING: 0,
    }
    for (const ws of workspaces) byStatus[ws.status]++
    return byStatus
  }, [workspaces])

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return workspaces.filter(
      (ws) =>
        (status === 'ALL' || ws.status === status) &&
        (!q ||
          normalize(ws.name).includes(q) ||
          ws.slug.includes(q) ||
          ws.id.includes(q)),
    )
  }, [workspaces, query, status])

  return (
    <AdminPanel
      flush
      title={
        <div
          role='tablist'
          aria-label='Filtrar por status'
          className='-my-1 flex flex-wrap gap-1'
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type='button'
              role='tab'
              aria-selected={status === filter.value}
              onClick={() => setStatus(filter.value)}
              className={cn(
                'h-7 rounded-md px-2 font-normal text-xs transition-colors',
                status === filter.value
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {filter.label}{' '}
              <span className='font-mono text-muted-foreground tabular-nums'>
                {counts[filter.value]}
              </span>
            </button>
          ))}
        </div>
      }
      actions={
        <div className='relative w-full sm:w-64'>
          <SteelIcon
            icon={Search01Icon}
            size={14}
            className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 text-muted-foreground'
          />
          <Input
            aria-label='Buscar workspace'
            placeholder='Buscar por nome, slug ou id'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className='h-8 pl-8 text-xs'
          />
        </div>
      }
    >
      {visible.length === 0 ? (
        <EmptyState
          title={
            workspaces.length === 0
              ? 'Nenhum workspace na plataforma'
              : 'Nenhum workspace encontrado'
          }
          description={
            workspaces.length === 0
              ? undefined
              : 'Ajuste a busca ou o filtro de status.'
          }
        />
      ) : (
        <Table className={DENSE_TABLE}>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className='text-right'>Membros</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((ws) => (
              <TableRow key={ws.id}>
                <TableCell className='max-w-72'>
                  <Link
                    href={`/admin/workspaces/${ws.id}`}
                    className='block truncate font-medium text-sm hover:underline'
                    title={ws.name}
                  >
                    {ws.name}
                  </Link>
                  <MonoId value={ws.slug} />
                </TableCell>
                <TableCell>
                  <WorkspaceStatusPill status={ws.status} />
                </TableCell>
                <TableCell>
                  {PLAN_LABEL[ws.activePlan] ?? ws.activePlan}
                </TableCell>
                <TableCell className='text-right font-mono tabular-nums'>
                  {formatNumber(ws.memberCount)}
                </TableCell>
                <TableCell className='font-mono text-muted-foreground'>
                  {formatDate(ws.createdAt)}
                </TableCell>
                <TableCell className='max-w-36'>
                  <MonoId value={ws.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminPanel>
  )
}
