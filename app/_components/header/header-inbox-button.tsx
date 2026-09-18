'use client'

import { InboxIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/src/hooks/use-notifications'

/** Atalho da caixa de entrada com a contagem de notificações não lidas. */
export function HeaderInboxButton({
  slug,
  workspaceId,
}: {
  slug: string
  workspaceId: string
}) {
  const notifications = useNotifications(workspaceId)
  const unread = notifications.data?.unreadCount ?? 0

  return (
    <Button
      variant='ghost'
      size='icon-sm'
      className='relative'
      render={
        <Link
          href={`/${slug}/inbox`}
          aria-label={
            unread > 0
              ? `Caixa de entrada: ${unread} não lidas`
              : 'Caixa de entrada'
          }
        />
      }
    >
      <SteelIcon icon={InboxIcon} strokeWidth={2} size={20} />
      {unread > 0 ? (
        <span className='-top-0.5 -right-0.5 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-medium text-[10px] text-white'>
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Button>
  )
}
