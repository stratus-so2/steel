'use client'

import { MagicWand01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { useSeedSdPhases } from '@/src/hooks/use-sd-config'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import { SD_TICKET_TYPE_LABEL } from '../ticket/sd-ticket-meta'

/**
 * Cria as fases padrão ITIL de um tipo, só as que faltam.
 *
 * Existe porque a única saída para um fluxo sem fase era "Restaurar padrões
 * ITIL", na aba Geral, que mexe em escalas, calendários, SLAs, catálogo e
 * regras — agressivo demais para resolver um quadro vazio. Usado na aba
 * Fluxos e no estado vazio do quadro.
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
