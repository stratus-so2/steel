'use client'

import { Robot01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'

export function WhatsappAiBanner({
  onRemoveFromAi,
  isRemoving,
}: {
  onRemoveFromAi: () => void
  isRemoving: boolean
}) {
  return (
    <div className='flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-2 text-sm'>
      <div className='flex items-center gap-2 text-primary'>
        <SteelIcon icon={Robot01Icon} size={16} />
        <span>
          A IA está atendendo esta conversa. Você pode espiar, mas não enviar
          mensagens.
        </span>
      </div>
      <Button
        size='xs'
        variant='outline'
        onClick={onRemoveFromAi}
        disabled={isRemoving}
      >
        Remover do atendimento da IA
      </Button>
    </div>
  )
}
