'use client'

import { UserSwitchIcon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'

export function WhatsappHandoffBanner({
  onResumeAi,
  isResuming,
}: {
  onResumeAi: () => void
  isResuming: boolean
}) {
  return (
    <div className='flex items-center justify-between gap-3 border-b bg-amber-500/10 px-4 py-2 text-sm'>
      <div className='flex items-center gap-2 text-amber-600 dark:text-amber-400'>
        <SteelIcon icon={UserSwitchIcon} size={16} />
        <span>Esta conversa foi transferida para atendimento humano.</span>
      </div>
      <Button
        size='xs'
        variant='outline'
        onClick={onResumeAi}
        disabled={isResuming}
      >
        Retomar atendimento da IA
      </Button>
    </div>
  )
}
