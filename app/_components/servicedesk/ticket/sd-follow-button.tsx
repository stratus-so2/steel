'use client'

import {
  Notification03Icon,
  NotificationOff01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { notify } from '@/lib/notify'
import {
  useSdTicketFollowers,
  useToggleSdTicketFollow,
} from '@/src/hooks/use-sd-notifications'

/**
 * "Seguir"/"Parar de seguir" o chamado: quem segue recebe os eventos cujo
 * público inclui `followers` no catálogo de notificações (nova mensagem,
 * mudança de fase, resolução, escalonamento…), mesmo sem ser responsável
 * nem participante.
 */
export function SdFollowButton({
  workspaceId,
  ticketRef,
}: {
  workspaceId: string
  ticketRef: string
}) {
  const query = useSdTicketFollowers(workspaceId, ticketRef)
  const toggle = useToggleSdTicketFollow(workspaceId, ticketRef)
  const following = query.data?.following ?? false
  const others = (query.data?.items.length ?? 0) - (following ? 1 : 0)

  const label = following ? 'Parar de seguir' : 'Seguir'
  const hint = following
    ? 'Você recebe os avisos deste chamado. Clique para parar.'
    : 'Receba um aviso a cada novidade deste chamado.'

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            size='sm'
            variant={following ? 'secondary' : 'outline'}
            aria-pressed={following}
            disabled={query.isLoading || toggle.isPending}
            onClick={() =>
              toggle.mutate(!following, {
                onSuccess: () =>
                  notify.success(
                    following
                      ? 'Você parou de seguir este chamado.'
                      : 'Pronto — você vai receber as novidades deste chamado.',
                  ),
                onError: (error) => notify.error(error),
              })
            }
          >
            <SteelIcon
              icon={following ? Notification03Icon : NotificationOff01Icon}
              strokeWidth={2}
            />
            {label}
            {others > 0 ? (
              <span className='text-muted-foreground text-xs tabular-nums'>
                +{others}
              </span>
            ) : null}
          </Button>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}
