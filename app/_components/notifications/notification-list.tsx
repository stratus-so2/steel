'use client'

import { ArrowUpRight01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useRef } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { NotificationDTO } from '@/types/notification'
import { NotificationKindIcon } from './notification-kind-icon'
import {
  notificationAbsoluteDate,
  notificationShortTime,
} from './notification-time'

export interface NotificationListProps {
  items: NotificationDTO[]
  /** Id da notificação aberta no painel de leitura. */
  activeId: string | null
  selectedIds: Set<string>
  loading: boolean
  hasNextPage: boolean
  loadingMore: boolean
  onOpen: (notification: NotificationDTO) => void
  onToggleSelect: (id: string) => void
  onLoadMore: () => void
  /** Rótulo do estado vazio, que muda conforme a pasta/filtro. */
  emptyLabel: string
}

/**
 * Coluna da lista, no formato de um cliente de e-mail: remetente (módulo),
 * assunto (título), prévia do corpo e horário. Cada linha é um botão — o
 * `Tab` passa por todas elas e os atalhos `j`/`k` só movem o foco, então o
 * teclado e o leitor de tela contam a mesma história.
 */
export function NotificationList({
  items,
  activeId,
  selectedIds,
  loading,
  hasNextPage,
  loadingMore,
  onOpen,
  onToggleSelect,
  onLoadMore,
  emptyLabel,
}: NotificationListProps) {
  const sentinel = useRef<HTMLDivElement | null>(null)

  // Paginação infinita: o sentinela no fim da lista pede a próxima página.
  // Onde não há IntersectionObserver (ou quando ele não dispara), o botão
  // "Carregar mais" abaixo faz o mesmo.
  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, onLoadMore])

  if (loading) {
    return (
      <div className='space-y-px p-2' aria-busy='true'>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className='flex items-start gap-3 px-2 py-3'>
            <Skeleton className='size-8 shrink-0 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-3 w-28' />
              <Skeleton className='h-3 w-full' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className='px-6 py-10 text-center text-muted-foreground text-sm'>
        {emptyLabel}
      </p>
    )
  }

  return (
    <div>
      <ul aria-label='Notificações' className='divide-y'>
        {items.map((notification) => {
          const selected = selectedIds.has(notification.id)
          const active = notification.id === activeId
          return (
            <li
              key={notification.id}
              className={cn(
                'flex items-start gap-2 px-2 py-1 transition-colors',
                active && 'bg-accent',
                !active && selected && 'bg-primary/5',
              )}
            >
              <span className='flex items-center pt-3.5 pl-1'>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(notification.id)}
                  aria-label={`Selecionar: ${notification.title}`}
                />
              </span>
              <button
                type='button'
                id={`notification-row-${notification.id}`}
                data-notification-row={notification.id}
                aria-current={active ? 'true' : undefined}
                onClick={() => onOpen(notification)}
                className={cn(
                  'flex min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-2.5 text-left',
                  'hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                )}
              >
                <NotificationKindIcon
                  icon={notification.icon}
                  color={notification.color}
                  className='mt-0.5 size-8'
                />
                <span className='min-w-0 flex-1'>
                  <span className='flex items-center gap-2'>
                    <span
                      className={cn(
                        'truncate text-xs',
                        notification.read
                          ? 'text-muted-foreground'
                          : 'font-medium text-foreground',
                      )}
                    >
                      {notification.moduleLabel}
                    </span>
                    <span className='truncate text-muted-foreground text-xs'>
                      {notification.kindLabel}
                    </span>
                    {notification.snoozedUntil ? (
                      <span className='shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground'>
                        {Date.parse(notification.snoozedUntil) > Date.now()
                          ? `Adiada até ${notificationShortTime(notification.snoozedUntil)}`
                          : 'Voltou'}
                      </span>
                    ) : null}
                    {notification.href ? (
                      <SteelIcon
                        icon={ArrowUpRight01Icon}
                        size={12}
                        strokeWidth={2}
                        className='shrink-0 text-muted-foreground'
                        aria-label='Tem ação'
                      />
                    ) : null}
                    <span
                      className='ml-auto shrink-0 text-muted-foreground text-xs'
                      title={notificationAbsoluteDate(notification.createdAt)}
                    >
                      {notificationShortTime(notification.createdAt)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block truncate text-sm',
                      notification.read
                        ? 'text-foreground/80'
                        : 'font-semibold text-foreground',
                    )}
                  >
                    {notification.title}
                  </span>
                  <span className='mt-0.5 block truncate text-muted-foreground text-xs'>
                    {notification.body}
                  </span>
                </span>
                {notification.read ? null : (
                  <span
                    className='mt-2 size-2 shrink-0 rounded-full bg-primary'
                    aria-label='Não lida'
                    role='img'
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div ref={sentinel} aria-hidden className='h-px' />

      {hasNextPage ? (
        <div className='p-3 text-center'>
          <Button
            size='xs'
            variant='outline'
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
