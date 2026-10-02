'use client'

import { MagicWand01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { useSeedSdPhases } from '@/src/hooks/use-sd-config'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import { SD_TICKET_TYPE_LABEL } from '../ticket/sd-ticket-meta'

/**
 * Creates the default ITIL phases of one ticket type, only the missing ones.
 *
 * It exists because the only way out of a flow with no phases was "Restaurar
 * padrões ITIL" on the General tab, which also touches scales, calendars,
 * SLAs, the catalog and the rules — far too blunt for fixing an empty board.
 * Used by the Fluxos tab and by the board's empty state.
 */
export function SdSeedPhasesButton({
  workspaceId,
  ticketType,
  variant = 'default',
  size = 'sm',
}: {
  workspaceId: string
  ticketType: SdTicketTypeDTO
  variant?: 'default' | 'outline'
  size?: 'sm' | 'xs'
}) {
  const seed = useSeedSdPhases(workspaceId)
  return (
    <Button
      variant={variant}
      size={size}
      disabled={seed.isPending}
      onClick={() =>
        seed.mutate(ticketType, {
          onSuccess: (summary) =>
            summary.created > 0
              ? notify.success(
                  `${summary.created} fase${summary.created === 1 ? '' : 's'} padrão criada${summary.created === 1 ? '' : 's'}.`,
                )
              : notify.info(
                  'As fases padrão deste tipo já estão todas cadastradas.',
                ),
          onError: notify.error,
        })
      }
    >
      <SteelIcon icon={MagicWand01Icon} strokeWidth={2} />
      Criar as fases padrão de {SD_TICKET_TYPE_LABEL[ticketType].toLowerCase()}
    </Button>
  )
}
