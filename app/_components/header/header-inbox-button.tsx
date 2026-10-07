'use client'

import { InboxIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { useBrowserNotificationDelivery } from '@/src/hooks/use-browser-notifications'
import {
  useInboxAiPending,
  useNotificationStream,
  useNotifications,
} from '@/src/hooks/use-notifications'

/** pt-BR label of the inbox shortcut, counting unread and AI pendings. */
export function inboxButtonLabel(unread: number, aiPending: number): string {
  const parts: string[] = []
  if (unread > 0) parts.push(`${unread} não lidas`)
  if (aiPending > 0) {
    parts.push(
      aiPending === 1 ? '1 pendência da IA' : `${aiPending} pendências da IA`,
    )
  }
  return parts.length > 0
    ? `Caixa de entrada: ${parts.join(', ')}`
    : 'Caixa de entrada'
}

/**
 * Atalho da caixa de entrada com a contagem de não lidas mais as
 * pendências da IA (ações a confirmar e aprovações de agentes). Também é o
 * ponto sempre montado que entrega as notificações do navegador.
 */
export function HeaderInboxButton({
  slug,
  workspaceId,
}: {
  slug: string
  workspaceId: string
}) {
  const router = useRouter()
  // SSE genérico de notificação: o contador sobe sem recarregar a página,
  // esteja o usuário na caixa de entrada ou em qualquer outra tela.
  useNotificationStream(workspaceId)
  useBrowserNotificationDelivery(workspaceId, (href) => router.push(href))
  const notifications = useNotifications(workspaceId)
  const aiPending = useInboxAiPending(workspaceId)
  const unread = notifications.data?.unreadCount ?? 0
  const pending = aiPending.data?.count ?? 0
  const total = unread + pending

  return (
    <Button
      variant='ghost'
      size='icon-sm'
      className='relative'
      render={
        <Link
          href={
            pending > 0 && unread === 0
              ? `/${slug}/inbox?view=ai`
              : `/${slug}/inbox`
          }
          aria-label={inboxButtonLabel(unread, pending)}
        />
      }
    >
      <SteelIcon icon={InboxIcon} strokeWidth={2} size={20} />
      {total > 0 ? (
        <span className='-top-0.5 -right-0.5 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-medium text-[10px] text-white'>
          {total > 99 ? '99+' : total}
        </span>
      ) : null}
    </Button>
  )
}
