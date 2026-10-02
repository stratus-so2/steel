'use client'

import {
  ArrowRight01Icon,
  Flowchart01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import { SdSeedPhasesButton } from '../settings/sd-seed-phases-button'
import { SD_TICKET_TYPE_LABEL } from '../ticket/sd-ticket-meta'

/**
 * Quadro sem nenhuma coluna porque o fluxo do tipo não tem fase cadastrada.
 *
 * O kanban monta uma coluna por fase (`sdTypePhases`), então um fluxo vazio
 * dava um quadro em branco, sem texto nenhum — foi o que fez o dono conviver
 * com o "kanban sempre vazio" sem descobrir que faltava configuração. Aqui a
 * tela diz o que falta, leva para Configurações > Fluxos e, para admin, cria
 * as fases padrão do tipo na hora.
 */
export function SdNoPhasesNotice({
  workspaceId,
  slug,
  type,
  isAdmin = false,
}: {
  workspaceId: string
  slug: string
  /** `null` no quadro "Todos": nenhum tipo tem fase. */
  type: SdTicketTypeDTO | null
  isAdmin?: boolean
}) {
  const label = type ? SD_TICKET_TYPE_LABEL[type].toLowerCase() : null
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
      <div className='flex size-12 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground'>
        <SteelIcon
          icon={Flowchart01Icon}
          strokeWidth={1.8}
          className='size-5'
        />
      </div>
      <p className='font-medium text-sm'>
        {label
          ? `Nenhuma fase configurada para ${label}`
          : 'Nenhum tipo de chamado tem fases configuradas'}
      </p>
      <p className='max-w-md text-muted-foreground text-xs'>
        O quadro monta uma coluna por fase do fluxo. Sem fase cadastrada não há
        coluna — e nenhum chamado aparece aqui, mesmo que existam chamados
        abertos. Veja-os na lista ou na tabela enquanto o fluxo não estiver
        configurado.
      </p>
      <div className='flex flex-wrap items-center justify-center gap-2'>
        <Link
          href={`/${slug}/servicedesk/settings?tab=flows`}
          className={buttonVariants({
            variant: isAdmin ? 'outline' : 'default',
            size: 'sm',
          })}
        >
          Configurações &gt; Fluxos
          <SteelIcon icon={ArrowRight01Icon} strokeWidth={2} />
        </Link>
        {isAdmin && type ? (
          <SdSeedPhasesButton workspaceId={workspaceId} ticketType={type} />
        ) : null}
      </div>
    </div>
  )
}
