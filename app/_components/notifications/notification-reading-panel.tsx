'use client'

import {
  Archive02Icon,
  ArchiveRestoreIcon,
  ArrowLeft01Icon,
  Delete02Icon,
  Mail01Icon,
  MailOpen01Icon,
  MailReply01Icon,
  NotificationOff01Icon,
  UserAdd01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { notify } from '@/lib/notify'
import {
  useAssignFromNotification,
  useNotificationConversationSummary,
  useNotificationTicketSummary,
} from '@/src/hooks/use-notifications'
import { notificationConversationRef } from '@/src/lib/notification-kind'
import type { NotificationSnoozePreset } from '@/src/lib/notifications/snooze'
import type { NotificationDTO } from '@/types/notification'
import { NotificationKindIcon } from './notification-kind-icon'
import {
  notificationMuteHref,
  notificationReplyHref,
  notificationSnoozeState,
} from './notification-quick-actions'
import { NotificationSnoozeMenu } from './notification-snooze-menu'
import {
  notificationAbsoluteDate,
  notificationRelativeTime,
} from './notification-time'

export interface NotificationReadingPanelProps {
  workspaceId: string
  /** Workspace slug, for the "silenciar este tipo" link. */
  slug?: string
  /** Current user, for "Atribuir a mim". */
  userId?: string
  notification: NotificationDTO | null
  onBack: () => void
  onToggleRead: (notification: NotificationDTO) => void
  onArchive: (notification: NotificationDTO) => void
  onDelete: (notification: NotificationDTO) => void
  onOpenHref: (notification: NotificationDTO) => void
  onSnooze?: (
    notification: NotificationDTO,
    preset: NotificationSnoozePreset,
  ) => void
  onUnsnooze?: (notification: NotificationDTO) => void
  /** Navigation for the quick actions (reply). */
  onNavigate?: (href: string) => void
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
 * degrada para o simples quando o dado não vem. Ações rápidas por tipo:
 * adiar, atribuir a mim (chamado/conversa sem responsável), responder e
 * silenciar o tipo.
 */
export function NotificationReadingPanel({
  workspaceId,
  slug,
  userId,
  notification,
  onBack,
  onToggleRead,
  onArchive,
  onDelete,
  onOpenHref,
  onSnooze,
  onUnsnooze,
  onNavigate,
}: NotificationReadingPanelProps) {
  const summary = useNotificationTicketSummary(workspaceId, notification?.href)
  const conversation = useNotificationConversationSummary(
    workspaceId,
    notification?.href,
  )
  const assign = useAssignFromNotification(workspaceId)
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

  const current = notification
  const replyHref = notificationReplyHref(current)
  const snoozeState = notificationSnoozeState(current.snoozedUntil, Date.now())

  // "Atribuir a mim": only when the record came back and nobody owns it.
  const conversationRef = notificationConversationRef(current.href)
  const assignTarget =
    userId && ticket?.id && ticket.assignee === null
      ? ({ type: 'ticket', id: ticket.id } as const)
      : userId && conversationRef && conversation.data
        ? conversation.data.assignedUserId === null
          ? ({ type: 'conversation', id: conversation.data.id } as const)
          : null
        : null

  function assignToMe() {
    if (!assignTarget || !userId) return
    assign.mutate(
      { target: assignTarget, userId },
      {
        onSuccess: () => {
          notify.success(
            assignTarget.type === 'ticket'
              ? 'Chamado atribuído a você'
              : 'Conversa atribuída a você',
          )
          if (assignTarget.type === 'ticket') summary.refetch()
          else conversation.refetch()
        },
        onError: (error) => notify.error(error, 'Não foi possível atribuir'),
      },
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
        <Button size='xs' variant='ghost' onClick={() => onToggleRead(current)}>
          <SteelIcon
            icon={current.read ? Mail01Icon : MailOpen01Icon}
            size={16}
            strokeWidth={2}
          />
          {current.read ? 'Marcar como não lida' : 'Marcar como lida'}
        </Button>
        <Button size='xs' variant='ghost' onClick={() => onArchive(current)}>
          <SteelIcon
            icon={current.archived ? ArchiveRestoreIcon : Archive02Icon}
            size={16}
            strokeWidth={2}
          />
          {current.archived ? 'Desarquivar' : 'Arquivar'}
        </Button>
        {snoozeState === 'snoozed' && onUnsnooze ? (
          <Button size='xs' variant='ghost' onClick={() => onUnsnooze(current)}>
            Desfazer adiamento
          </Button>
        ) : onSnooze ? (
          <NotificationSnoozeMenu
            onSnooze={(preset) => onSnooze(current, preset)}
          />
        ) : null}
        <Button size='xs' variant='ghost' onClick={() => onDelete(current)}>
          <SteelIcon icon={Delete02Icon} size={16} strokeWidth={2} />
          Excluir
        </Button>
      </header>

      <div className='flex-1 overflow-y-auto p-5'>
        <div className='flex items-start gap-3'>
          <NotificationKindIcon
            icon={current.icon}
            color={current.color}
            size={20}
            className='size-10'
          />
          <div className='min-w-0 flex-1'>
            <h2 className='font-semibold text-base text-foreground'>
              {current.title}
            </h2>
            <p className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs'>
              <span className='font-medium text-foreground/80'>
                {current.moduleLabel}
              </span>
              <span aria-hidden>·</span>
              <span>{current.kindLabel}</span>
              <span aria-hidden>·</span>
              <time dateTime={current.createdAt}>
                {notificationAbsoluteDate(current.createdAt)}
              </time>
              <span aria-hidden>·</span>
              <span>{notificationRelativeTime(current.createdAt)}</span>
            </p>
          </div>
          <div className='flex shrink-0 flex-col items-end gap-1'>
            {current.read ? null : <Badge variant='secondary'>Não lida</Badge>}
            {snoozeState === 'snoozed' && current.snoozedUntil ? (
              <Badge variant='outline'>
                Adiada até {notificationAbsoluteDate(current.snoozedUntil)}
              </Badge>
            ) : null}
            {snoozeState === 'resurfaced' ? (
              <Badge variant='outline'>Voltou do adiamento</Badge>
            ) : null}
          </div>
        </div>

        <Separator className='my-4' />

        <p className='whitespace-pre-wrap text-foreground text-sm leading-relaxed'>
          {current.body}
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
              {ticket.assignee !== undefined ? (
                <span className='text-muted-foreground text-xs'>
                  Responsável: {ticket.assignee?.name ?? 'ninguém'}
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className='mt-6 flex flex-wrap items-center gap-2'>
          {current.href ? (
            <Button size='sm' onClick={() => onOpenHref(current)}>
              {actionLabel(current, ticket?.code)}
            </Button>
          ) : null}
          {replyHref && onNavigate ? (
            <Button
              size='sm'
              variant='outline'
              onClick={() => onNavigate(replyHref)}
            >
              <SteelIcon icon={MailReply01Icon} size={16} strokeWidth={2} />
              Responder
            </Button>
          ) : null}
          {assignTarget ? (
            <Button
              size='sm'
              variant='outline'
              disabled={assign.isPending}
              onClick={assignToMe}
            >
              <SteelIcon icon={UserAdd01Icon} size={16} strokeWidth={2} />
              Atribuir a mim
            </Button>
          ) : null}
        </div>

        {slug ? (
          <p className='mt-6 text-muted-foreground text-xs'>
            <Link
              href={notificationMuteHref(slug, current.kind)}
              className='inline-flex items-center gap-1 hover:text-foreground hover:underline'
            >
              <SteelIcon
                icon={NotificationOff01Icon}
                size={14}
                strokeWidth={2}
              />
              Silenciar avisos do tipo “{current.kindLabel}”
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  )
}
