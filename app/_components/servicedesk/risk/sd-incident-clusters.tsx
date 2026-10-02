'use client'

import {
  Bug01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InboxIcon,
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
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { useSdAgents, useSdConfig } from '@/src/hooks/use-sd-config'
import {
  useDismissSdIncidentCluster,
  useOpenSdClusterProblem,
  useSdIncidentClusters,
} from '@/src/hooks/use-sd-risk'
import type { SdIncidentClusterDTO } from '@/types/sd-risk'
import { SdOptionSelect } from '../ticket/sd-option-select'
import { sdFormatDateTime, sdRelativeTime } from '../ticket/sd-ticket-meta'
import { sdDepartmentOptions } from '../ticket/sd-ticket-options'

/**
 * Sugestões de problema: incidentes parecidos agrupados pelo worker
 * (`scan-clusters`). Abrir o problema é **ação do agente** — a análise
 * nunca abre nada sozinha (ADR 0016).
 */

function ClusterTickets({
  cluster,
  slug,
}: {
  cluster: SdIncidentClusterDTO
  slug: string
}) {
  return (
    <ul className='flex flex-col divide-y rounded-lg border bg-background/60'>
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

function ClusterCard({
  workspaceId,
  slug,
  cluster,
}: {
  workspaceId: string
  slug: string
  cluster: SdIncidentClusterDTO
}) {
  const dismiss = useDismissSdIncidentCluster(workspaceId)
  const [opening, setOpening] = useState(false)
  const handled = Boolean(cluster.problemTicket || cluster.dismissedAt)

  return (
    <article className='flex flex-col gap-2.5 rounded-xl border bg-card p-3'>
      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <span className='inline-flex h-5 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 font-medium text-[11px] text-amber-700 tabular-nums dark:border-amber-400/30 dark:text-amber-300'>
          <SteelIcon icon={Bug01Icon} strokeWidth={2} className='size-3' />
          {cluster.ticketCount} incidentes
        </span>
        <h3 className='min-w-0 flex-1 truncate font-medium text-sm'>
          {cluster.title}
        </h3>
        <span className='text-muted-foreground text-xs'>
          último {sdRelativeTime(cluster.lastSeenAt)}
        </span>
      </div>

      <ClusterTickets cluster={cluster} slug={slug} />

      {cluster.problemTicket ? (
        <p className='flex items-center gap-1.5 text-emerald-700 text-xs dark:text-emerald-300'>
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
        </p>
      ) : cluster.dismissedAt ? (
        <p className='text-muted-foreground text-xs'>
          Descartado por {cluster.dismissedBy?.name ?? 'alguém da equipe'} em{' '}
          {sdFormatDateTime(cluster.dismissedAt)}.
        </p>
      ) : (
        <div className='flex items-center justify-end gap-2'>
          <Button
            variant='ghost'
            size='sm'
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
          <Button size='sm' onClick={() => setOpening(true)}>
            <SteelIcon icon={Bug01Icon} strokeWidth={2} />
            Abrir problema
          </Button>
        </div>
      )}

      {handled ? null : (
        <OpenProblemDialog
          workspaceId={workspaceId}
          cluster={cluster}
          open={opening}
          onOpenChange={setOpening}
        />
      )}
    </article>
  )
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
  const { data, isLoading } = useSdIncidentClusters(workspaceId, { status })

  if (isLoading) {
    return (
      <div className='flex flex-col gap-2'>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={`sk-cluster-${i}`} className='h-28 w-full' />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center'>
        <div className='flex size-10 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground'>
          <SteelIcon icon={InboxIcon} strokeWidth={1.8} className='size-5' />
        </div>
        <p className='font-medium text-sm'>Nenhum incidente repetido</p>
        <p className='max-w-sm text-muted-foreground text-xs'>
          A análise agrupa incidentes parecidos dos últimos 7 dias a partir de
          três ocorrências com a mesma assinatura.
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-2.5'>
      {data.map((cluster) => (
        <ClusterCard
          key={cluster.id}
          workspaceId={workspaceId}
          slug={slug}
          cluster={cluster}
        />
      ))}
    </div>
  )
}
