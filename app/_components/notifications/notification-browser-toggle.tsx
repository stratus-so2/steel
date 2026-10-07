'use client'

import {
  Cancel01Icon,
  Notification03Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { useBrowserNotificationSetting } from '@/src/hooks/use-browser-notifications'

const DISMISS_KEY = 'steel:notifications:browser-prompt-dismissed'

/** pt-BR list of what reaches the desktop (mirrors URGENT_NOTIFICATION_KINDS). */
export const BROWSER_NOTIFICATION_SCOPE =
  'SLA violado ou em risco, aprovações pendentes (incluindo de agentes), chamado ou conversa atribuída a você e ação da IA prestes a expirar.'

const BLOCKED_MESSAGE =
  'O navegador bloqueou as notificações deste site. Libere nas configurações do navegador e tente de novo.'

async function toggle(
  setEnabled: (next: boolean) => Promise<boolean>,
  next: boolean,
) {
  try {
    const done = await setEnabled(next)
    if (!done) {
      notify.error(BLOCKED_MESSAGE)
      return
    }
    notify.success(
      next
        ? 'Notificações do navegador ativadas'
        : 'Notificações do navegador desativadas',
    )
  } catch (error) {
    notify.error(error, 'Não foi possível salvar a preferência')
  }
}

/**
 * Opt-in prompt shown at the top of the inbox while the user has not decided
 * yet (browser permission still "default" and the switch off). "Agora não"
 * hides it on this device.
 */
export function NotificationBrowserPrompt({
  workspaceId,
}: {
  workspaceId: string
}) {
  const setting = useBrowserNotificationSetting(workspaceId)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (
    dismissed ||
    setting.loading ||
    setting.enabled ||
    setting.permission !== 'default'
  ) {
    return null
  }

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Blocked storage: hidden for this visit only.
    }
  }

  return (
    <section
      aria-label='Notificações do navegador'
      className='flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm'
    >
      <SteelIcon
        icon={Notification03Icon}
        size={16}
        strokeWidth={2}
        className='shrink-0 text-primary'
      />
      <span className='min-w-0 flex-1 text-muted-foreground'>
        Receba os avisos urgentes no navegador quando o Steel estiver em segundo
        plano.
      </span>
      <Button
        size='xs'
        disabled={setting.saving}
        onClick={() => toggle(setting.setEnabled, true)}
      >
        Ativar
      </Button>
      <Button
        size='icon-xs'
        variant='ghost'
        aria-label='Agora não'
        onClick={dismiss}
      >
        <SteelIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
      </Button>
    </section>
  )
}

/** Settings card: the per-user switch of browser notifications. */
export function NotificationBrowserSettingCard({
  workspaceId,
}: {
  workspaceId: string
}) {
  const setting = useBrowserNotificationSetting(workspaceId)
  const unsupported = setting.permission === 'unsupported'
  const blocked = setting.permission === 'denied'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações do navegador</CardTitle>
        <CardDescription>
          Só com a aba do Steel em segundo plano: {BROWSER_NOTIFICATION_SCOPE}
          {unsupported
            ? ' Este navegador não oferece notificações.'
            : blocked
              ? ` ${BLOCKED_MESSAGE}`
              : ''}
        </CardDescription>
        <CardAction>
          <Switch
            checked={setting.enabled}
            disabled={unsupported || setting.loading || setting.saving}
            onCheckedChange={(next) => toggle(setting.setEnabled, next)}
            aria-label='Notificações do navegador'
          />
        </CardAction>
      </CardHeader>
    </Card>
  )
}
