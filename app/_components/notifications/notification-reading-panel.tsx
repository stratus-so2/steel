'use client'

import {
  Archive02Icon,
  ArchiveRestoreIcon,
  ArrowLeft01Icon,
  Delete02Icon,
  Mail01Icon,
  MailOpen01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNotificationTicketSummary } from '@/src/hooks/use-notifications'
import type { NotificationDTO } from '@/types/notification'
import { NotificationKindIcon } from './notification-kind-icon'
import {
  notificationAbsoluteDate,
  notificationRelativeTime,
} from './notification-time'

export interface NotificationReadingPanelProps {
  workspaceId: string
  notification: NotificationDTO | null
  onBack: () => void
  onToggleRead: (notification: NotificationDTO) => void
  onArchive: (notification: NotificationDTO) => void
  onDelete: (notification: NotificationDTO) => void
  onOpenHref: (notification: NotificationDTO) => void
}

/**
 * Texto do botão de ação principal. Quando o resumo do chamado chegou, o
 * botão diz o código (`Abrir chamado INC-000123`); sem resumo, fica no
 * genérico.
 */
function actionLabel(
  notification: NotificationDTO,
  ticketCode: string | undefined,
): string {
  if (ticketCode) return `Abrir chamado ${ticketCode}`
  if (notification.module === 'COMMUNICATION') return 'Abrir conversa'
  return 'Abrir'
}

/**
 * Painel de leitura: título, corpo, origem, data absoluta e relativa, as
 * mesmas ações da lista e o botão que leva ao `href`. Quando o link aponta
 * para um chamado, mostra um resumo leve (código, fase, prioridade) — e
 * degrada para o simples quando o dado não vem.
 */
export function NotificationReadingPanel({
  workspaceId,
  notification,
  onBack,
  onToggleRead,
  onArchive,
  onDelete,
  onOpenHref,
}: NotificationReadingPanelProps) {
  const summary = useNotificationTicketSummary(workspaceId, notification?.href)
  const ticket = summary.data ?? null

  if (!notification) {
    return (
      <div className='flex h-full items-center justify-center p-10'>
        <p className='max-w-xs text-center text-muted-foreground text-sm'>
          Selecione uma notificação para ler. Use <kbd>j</kbd> e <kbd>k</kbd>{' '}
          para navegar e <kbd>?</kbd> para ver os atalhos.
        </p>
      </div>
    )
  }

  return (
    <article aria-label='Notificação' className='flex h-full flex-col'>
      <header className='flex flex-wrap items-center gap-1 border-b p-3'>
        <Button
          size='icon-sm'
          variant='ghost'
          className='lg:hidden'
          aria-label='Voltar para a lista'
          onClick={onBack}
        >
          <SteelIcon icon={ArrowLeft01Icon} size={18} strokeWidth={2} />
        </Button>
        <Button
          size='xs'
          variant='ghost'
          onClick={() => onToggleRead(notification)}
        >
          <SteelIcon
            icon={notification.read ? Mail01Icon : MailOpen01Icon}
            size={16}
            strokeWidth={2}
          />
          {notification.read ? 'Marcar como não lida' : 'Marcar como lida'}
        </Button>
        <Button
          size='xs'
          variant='ghost'
          onClick={() => onArchive(notification)}
        >
          <SteelIcon
            icon={notification.archived ? ArchiveRestoreIcon : Archive02Icon}
            size={16}
            strokeWidth={2}
          />
          {notification.archived ? 'Desarquivar' : 'Arquivar'}
        </Button>
        <Button
          size='xs'
          variant='ghost'
          onClick={() => onDelete(notification)}
        >
          <SteelIcon icon={Delete02Icon} size={16} strokeWidth={2} />
          Excluir
        </Button>
      </header>

      <div className='flex-1 overflow-y-auto p-5'>
        <div className='flex items-start gap-3'>
          <NotificationKindIcon
            icon={notification.icon}
            color={notification.color}
            size={20}
            className='size-10'
          />
          <div className='min-w-0 flex-1'>
            <h2 className='font-semibold text-base text-foreground'>
              {notification.title}
            </h2>
            <p className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs'>
              <span className='font-medium text-foreground/80'>
                {notification.moduleLabel}
              </span>
              <span aria-hidden>·</span>
              <span>{notification.kindLabel}</span>
              <span aria-hidden>·</span>
              <time dateTime={notification.createdAt}>
                {notificationAbsoluteDate(notification.createdAt)}
              </time>
              <span aria-hidden>·</span>
              <span>{notificationRelativeTime(notification.createdAt)}</span>
            </p>
          </div>
          {notification.read ? null : (
            <Badge variant='secondary' className='shrink-0'>
              Não lida
            </Badge>
          )}
        </div>

        <Separator className='my-4' />

        <p className='whitespace-pre-wrap text-foreground text-sm leading-relaxed'>
          {notification.body}
        </p>

        {ticket ? (
          <section
            aria-label='Resumo do chamado'
            className='mt-5 rounded-lg border bg-muted/30 p-3'
          >
            <p className='font-medium text-foreground text-xs'>{ticket.code}</p>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              {ticket.phase ? (
                <Badge
                  variant='outline'
                  // A cor da fase é configurável por workspace (hex), então
                  // entra como estilo e não como classe do tema.
                  style={
                    ticket.phase.color
                      ? { borderColor: ticket.phase.color }
                      : undefined
                  }
                >
                  {ticket.phase.name}
                </Badge>
              ) : null}
              {ticket.priority ? (
                <span className='text-muted-foreground text-xs'>
                  Prioridade: {ticket.priority.name}
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        {notification.href ? (
          <div className='mt-6'>
            <Button size='sm' onClick={() => onOpenHref(notification)}>
              {actionLabel(notification, ticket?.code)}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
