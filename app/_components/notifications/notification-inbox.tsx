'use client'

import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useMarkNotificationsRead,
  useNotifications,
} from '@/src/hooks/use-notifications'
import type { NotificationDTO } from '@/types/notification'

/** Lista de notificações do usuário no workspace (caixa de entrada). */
export function NotificationInbox({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const notifications = useNotifications(workspaceId)
  const markRead = useMarkNotificationsRead(workspaceId)
  const items = notifications.data?.items ?? []
  const unread = notifications.data?.unreadCount ?? 0

  function handleOpen(notification: NotificationDTO) {
    if (!notification.read) markRead.mutate([notification.id])
    if (notification.href) router.push(notification.href)
  }

  return (
    <div className='max-w-2xl space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h2 className='font-medium text-sm'>Notificações</h2>
          <p className='text-muted-foreground text-xs'>
            {unread > 0
              ? `${unread} não lida${unread > 1 ? 's' : ''}`
              : 'Tudo em dia'}
          </p>
        </div>
        <Button
          size='xs'
          variant='outline'
          disabled={unread === 0 || markRead.isPending}
          onClick={() =>
            markRead.mutate(undefined, {
              onError: (error) =>
                notify.error(error, 'Não foi possível marcar como lidas'),
            })
          }
        >
          Marcar todas como lidas
        </Button>
      </div>

      {notifications.isLoading ? (
        <p className='text-muted-foreground text-sm'>Carregando...</p>
      ) : items.length === 0 ? (
        <p className='rounded-md border px-4 py-6 text-center text-muted-foreground text-sm'>
          Nenhuma notificação por aqui.
        </p>
      ) : (
        <ul className='divide-y rounded-md border'>
          {items.map((notification) => (
            <li key={notification.id}>
              <button
                type='button'
                onClick={() => handleOpen(notification)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted',
                  !notification.read && 'bg-primary/5',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    notification.read ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                <span className='min-w-0 flex-1'>
                  <span className='block font-medium text-sm'>
                    {notification.title}
                  </span>
                  <span className='block text-muted-foreground text-xs'>
                    {notification.body}
                  </span>
                </span>
                <span className='shrink-0 text-muted-foreground text-xs'>
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
