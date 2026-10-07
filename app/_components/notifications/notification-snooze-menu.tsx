'use client'

import { AlarmClockIcon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  NOTIFICATION_SNOOZE_PRESETS,
  type NotificationSnoozePreset,
} from '@/src/lib/notifications/snooze'

export const SNOOZE_PRESET_LABELS: Record<NotificationSnoozePreset, string> = {
  '1h': 'Daqui a 1 hora',
  '3h': 'Daqui a 3 horas',
  tomorrow: 'Amanhã, às 9h',
  'next-week': 'Próxima semana (segunda, 9h)',
}

/**
 * "Adiar" menu: hides the notification(s) until the chosen time, in the
 * user's timezone, and brings them back as unread. Controlled `open` lets
 * the `s` shortcut open it from the keyboard.
 */
export function NotificationSnoozeMenu({
  onSnooze,
  open,
  onOpenChange,
  disabled,
  label = 'Adiar',
  size = 'xs',
}: {
  onSnooze: (preset: NotificationSnoozePreset) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  label?: string
  size?: 'xs' | 'sm'
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button size={size} variant='ghost' disabled={disabled}>
            <SteelIcon icon={AlarmClockIcon} size={16} strokeWidth={2} />
            {label}
          </Button>
        }
      />
      <DropdownMenuContent align='start' className='w-60'>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Adiar até</DropdownMenuLabel>
          {NOTIFICATION_SNOOZE_PRESETS.map((preset) => (
            <DropdownMenuItem key={preset} onClick={() => onSnooze(preset)}>
              {SNOOZE_PRESET_LABELS[preset]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
