'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import {
  NOTIFICATION_SNOOZE_PRESETS,
  type NotificationSnoozePreset,
} from '@/src/lib/notifications/snooze'
import { SNOOZE_PRESET_LABELS } from './notification-snooze-menu'

/**
 * Keyboard path of "Adiar" (`s`): a small dialog where `1`–`4` pick the
 * preset. The mouse path is `NotificationSnoozeMenu`.
 */
export function NotificationSnoozeDialog({
  open,
  onOpenChange,
  count,
  onSnooze,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many notifications will be snoozed (title). */
  count: number
  onSnooze: (preset: NotificationSnoozePreset) => void
}) {
  function pick(preset: NotificationSnoozePreset) {
    onSnooze(preset)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='sm:max-w-sm'
        onKeyDown={(event) => {
          const index = Number(event.key) - 1
          const preset = NOTIFICATION_SNOOZE_PRESETS[index]
          if (preset) {
            event.preventDefault()
            pick(preset)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {count === 1 ? 'Adiar notificação' : `Adiar ${count} notificações`}
          </DialogTitle>
          <DialogDescription>
            Ela some da caixa de entrada e volta como não lida no horário
            escolhido (no seu fuso).
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          {NOTIFICATION_SNOOZE_PRESETS.map((preset, index) => (
            <Button
              key={preset}
              variant='outline'
              className='justify-between'
              onClick={() => pick(preset)}
            >
              {SNOOZE_PRESET_LABELS[preset]}
              <Kbd>{index + 1}</Kbd>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
