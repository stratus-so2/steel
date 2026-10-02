'use client'

import {
  HierarchyIcon,
  Link01Icon,
  PlusSignIcon,
  Unlink01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { useSetSdTicketParentOf } from '@/src/hooks/use-sd-ticket-ui'
import { useSdTickets } from '@/src/hooks/use-sd-tickets'
import { SdCreateTicketSheet } from '../sd-create-ticket-sheet'
import {
  SdLevelBadge,
  SdPhaseBadge,
  SdSlaChip,
  SdTypeBadge,
  SdUserAvatar,
  useSdNow,
} from '../sd-ticket-badges'
import { SD_TONE_FILL, sdPrimarySla, sdTicketHref } from '../sd-ticket-meta'
import { SdTicketPicker } from '../sd-ticket-picker'
import type { SdTicketTabProps } from './types'

/**
 * Itens filhos: lista os chamados cujo pai é este, abre um filho já
 * vinculado (mesmo tipo e cliente) e vincula/desvincula existentes.
 */
export function SdTicketChildrenTab({
  workspaceId,
  slug,
  ticket,
  mode,
}: SdTicketTabProps) {
  const now = useSdNow()
  const children = useSdTickets(workspaceId, {
    parentId: ticket.id,
    includeClosed: true,
    pageSize: 100,
    sort: 'createdAt',
    order: 'asc',
  })
  const setParent = useSetSdTicketParentOf(workspaceId)
  const [creating, setCreating] = useState(false)
  const [linking, setLinking] = useState(false)
  const items = children.data?.items ?? []
  const done = items.filter((t) =>
    ['RESOLVED', 'CLOSED', 'CANCELED'].includes(t.phase.category),
  ).length

  function link(childId: string) {
    setParent.mutate(
      { ticketId: childId, parentId: ticket.id },
      {
        onSuccess: (child) => {
          notify.success(`${child.code} vinculado como filho.`)
          setLinking(false)
        },
        onError: notify.error,
      },
    )
  }

  function unlink(childId: string, code: string) {
    setParent.mutate(
      { ticketId: childId, parentId: null },
      {
        onSuccess: () => notify.success(`${code} desvinculado.`),
        onError: notify.error,
      },
    )
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='font-semibold text-sm'>Itens filhos</h3>
        {items.length > 0 ? (
          <span className='text-muted-foreground text-xs tabular-nums'>
            {done}/{items.length} concluídos
          </span>
        ) : null}
        {mode === 'agent' ? (
          <div className='ml-auto flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setLinking((v) => !v)}
            >
              <SteelIcon icon={Link01Icon} strokeWidth={2} />
              Vincular existente
            </Button>
            <Button size='sm' onClick={() => setCreating(true)}>
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Novo item filho
            </Button>
          </div>
        ) : null}
      </div>

      {linking ? (
        <div className='flex flex-col gap-1.5 rounded-lg border border-dashed p-3'>
          <span className='text-muted-foreground text-xs'>
            Escolha o chamado que passa a ser filho de {ticket.code}:
          </span>
          <SdTicketPicker
            workspaceId={workspaceId}
            value={null}
            excludeIds={[
              ticket.id,
              ...(ticket.parent ? [ticket.parent.id] : []),
              ...items.map((t) => t.id),
            ]}
            onChange={(option) => option && link(option.id)}
          />
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
          <div
            className={cn('h-full rounded-full transition-all', SD_TONE_FILL.emerald)}
            style={{ width: `${Math.round((done / items.length) * 100)}%` }}
          />
        </div>
      ) : null}

      {children.isLoading ? (
        <Skeleton className='h-24 w-full' />
      ) : items.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center'>
          <SteelIcon
            icon={HierarchyIcon}
            strokeWidth={1.8}
            className='size-5 text-muted-foreground'
          />
          <p className='text-muted-foreground text-sm'>
            Nenhum item filho. Divida o trabalho em chamados menores.
          </p>
        </div>
      ) : (
        <ul className='overflow-hidden rounded-xl border'>
          {items.map((child) => (
            <li
              key={child.id}
              className='flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40'
            >
              <Link
                href={sdTicketHref(slug, child)}
                className='w-24 shrink-0 font-mono text-muted-foreground text-xs hover:underline'
              >
                {child.code}
              </Link>
              <SdTypeBadge
                type={child.type}
                className='hidden sm:inline-flex'
              />
              <Link
                href={sdTicketHref(slug, child)}
                className='min-w-0 flex-1 truncate font-medium hover:underline'
              >
                {child.title}
              </Link>
              <SdPhaseBadge phase={child.phase} />
              <SdLevelBadge
                level={child.priority}
                className='hidden md:inline-flex'
              />
              <SdSlaChip live={sdPrimarySla(child.sla, now).live} compact />
              <SdUserAvatar user={child.assignee} className='size-6' />
              {mode === 'agent' ? (
                <Button
                  variant='ghost'
                  size='icon-xs'
                  aria-label={`Desvincular ${child.code}`}
                  disabled={setParent.isPending}
                  onClick={() => unlink(child.id, child.code)}
                >
                  <SteelIcon icon={Unlink01Icon} strokeWidth={2} />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {mode === 'agent' ? (
        <SdCreateTicketSheet
          workspaceId={workspaceId}
          slug={slug}
          open={creating}
          onOpenChange={setCreating}
          defaultType={ticket.type}
          preset={{
            type: ticket.type,
            parent: {
              id: ticket.id,
              label: `${ticket.code} · ${ticket.title}`,
            },
            values: {
              customerId: ticket.customer?.id ?? null,
              companyId: ticket.company?.id ?? null,
              departmentId: ticket.department?.id ?? null,
            },
            labels: {
              ...(ticket.customer ? { customerId: ticket.customer.name } : {}),
              ...(ticket.company ? { companyId: ticket.company.name } : {}),
            },
          }}
          onCreated={() => undefined}
        />
      ) : null}
    </div>
  )
}
