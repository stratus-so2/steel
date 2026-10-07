'use client'

import { cn } from '@/lib/utils'
import { useSdOnCallNow } from '@/src/hooks/use-sd-oncall'
import { SdUserAvatar } from './sd-ticket-badges'
import { SD_TONE } from './sd-ticket-meta'

/**
 * Indicador discreto de quem está de plantão agora no departamento — vai no
 * cabeçalho do chamado e do quadro. Só aparece quando a escala está valendo
 * (ativa e, se tiver calendário, fora do expediente): dentro do horário
 * comercial quem atende é a fila normal, e o selo seria ruído.
 */
export function SdOnCallBadge({
  workspaceId,
  departmentId,
  className,
  quiet,
}: {
  workspaceId: string
  departmentId: string | null | undefined
  className?: string
  /** Só texto, sem fundo de tom (coluna de detalhes do chamado). */
  quiet?: boolean
}) {
  const { data } = useSdOnCallNow(workspaceId, {
    departmentId: departmentId ?? null,
    enabled: !!workspaceId,
  })
  const current = (data ?? []).find((entry) => entry.applies)
  const slot = current?.layers.find((layer) => layer.userId)
  if (!current || !slot?.user) return null

  const backup = current.layers.find(
    (layer) => layer.level > slot.level && layer.user,
  )

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-xs',
        quiet ? 'text-muted-foreground' : SD_TONE.emerald,
        className,
      )}
      title={[
        `Plantão "${current.scheduleName}"`,
        `${slot.layerName}: ${slot.user.name}`,
        backup?.user ? `${backup.layerName}: ${backup.user.name}` : null,
        current.offHours ? 'Fora do expediente' : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <SdUserAvatar user={slot.user} className='size-4' />
      <span className='max-w-36 truncate'>De plantão: {slot.user.name}</span>
    </span>
  )
}
