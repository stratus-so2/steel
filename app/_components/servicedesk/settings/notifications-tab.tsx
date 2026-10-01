'use client'

import {
  Mail01Icon,
  Notification03Icon,
  WhatsappIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useRestoreSdNotificationPreferences,
  useSaveSdNotificationPreferences,
  useSdNotificationPreferences,
} from '@/src/hooks/use-sd-notifications'
import type {
  SdNotificationChannelDTO,
  SdNotificationEventPreferenceDTO,
  SdNotificationPreferencesDTO,
} from '@/types/sd-notification'
import {
  EmptyState,
  SettingsSection,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "Notificações" das configurações do ServiceDesk: matriz evento × canal
 * **do próprio usuário** (não é configuração do workspace, então vale também
 * para quem não é admin). Sem linha salva vale o padrão do catálogo; o botão
 * "Restaurar padrões" apaga tudo o que foi salvo.
 */

const CHANNELS: {
  id: SdNotificationChannelDTO
  label: string
  icon: typeof Mail01Icon
}[] = [
  { id: 'IN_APP', label: 'No app', icon: Notification03Icon },
  { id: 'EMAIL', label: 'E-mail', icon: Mail01Icon },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: WhatsappIcon },
]

/** `evento|canal` das células que o usuário mexeu nesta sessão. */
type Draft = Map<string, boolean>

export function sdCellKey(
  event: string,
  channel: SdNotificationChannelDTO,
): string {
  return `${event}|${channel}`
}

/** Estado exibido: o rascunho local vence o que veio do servidor. */
export function sdCellChecked(
  row: SdNotificationEventPreferenceDTO,
  channel: SdNotificationChannelDTO,
  draft: Draft,
): boolean {
  return (
    draft.get(sdCellKey(row.event, channel)) ??
    row.enabledChannels.includes(channel)
  )
}

/** Canais que aparecem na matriz (esconde WhatsApp sem conexão ativa). */
export function sdVisibleChannels(
  data: SdNotificationPreferencesDTO | undefined,
): typeof CHANNELS {
  if (!data) return CHANNELS
  return CHANNELS.filter(
    (channel) => channel.id !== 'WHATSAPP' || data.whatsappAvailable,
  )
}

/** A aba lê o workspace do provedor da tela de configurações. */
export function SdNotificationsTab() {
  const { workspaceId } = useSdSettingsContext()
  return <SdNotificationsMatrix workspaceId={workspaceId} />
}

export function SdNotificationsMatrix({
  workspaceId,
}: {
  workspaceId: string
}) {
  const query = useSdNotificationPreferences(workspaceId)
  const save = useSaveSdNotificationPreferences(workspaceId)
  const restore = useRestoreSdNotificationPreferences(workspaceId)
  const [draft, setDraft] = useState<Draft>(new Map())

  const channels = useMemo(() => sdVisibleChannels(query.data), [query.data])
  const dirty = draft.size > 0

  function toggle(
    event: string,
    channel: SdNotificationChannelDTO,
    next: boolean,
  ) {
    setDraft((current) => {
      const copy = new Map(current)
      copy.set(sdCellKey(event, channel), next)
      return copy
    })
  }

  function submit() {
    const items = [...draft.entries()].map(([key, enabled]) => {
      const [event, channel] = key.split('|')
      return {
        event: event as string,
        channel: channel as SdNotificationChannelDTO,
        enabled,
      }
    })
    save.mutate(
      { items },
      {
        onSuccess: () => {
          setDraft(new Map())
          notify.success('Preferências salvas.')
        },
        onError: (error) => notify.error(error),
      },
    )
  }

  if (query.isLoading) {
    return (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-48 w-full' />
      </div>
    )
  }
  if (query.error || !query.data) {
    return (
      <p className='text-destructive text-sm'>
        {query.error?.message ??
          'Não foi possível carregar as preferências de notificação.'}
      </p>
    )
  }

  return (
    <div className='flex flex-col gap-5'>
      <SettingsSection
        title='Como você quer ser avisado'
        description='Vale só para você, neste workspace. O que não estiver marcado deixa de chegar por aquele canal; "Restaurar padrões" volta tudo ao que o módulo sugere.'
        actions={
          <>
            <Button
              variant='outline'
              size='sm'
              disabled={restore.isPending || save.isPending}
              onClick={() =>
                restore.mutate(undefined, {
                  onSuccess: () => {
                    setDraft(new Map())
                    notify.success('Padrões restaurados.')
                  },
                  onError: (error) => notify.error(error),
                })
              }
            >
              Restaurar padrões
            </Button>
            <Button
              size='sm'
              disabled={!dirty || save.isPending}
              onClick={submit}
            >
              Salvar
            </Button>
          </>
        }
      >
        {!query.data.whatsappAvailable ? (
          <p className='text-muted-foreground text-xs'>
            O canal WhatsApp aparece aqui quando o workspace tiver uma conexão
            de WhatsApp do ServiceDesk ativa.
          </p>
        ) : null}

        {query.data.groups.length === 0 ? (
          <EmptyState>
            Nenhuma notificação disponível para o seu perfil.
          </EmptyState>
        ) : (
          query.data.groups.map((group) => (
            <div key={group.label} className='flex flex-col gap-2'>
              <h4 className='font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
                {group.label}
              </h4>
              <div className='overflow-x-auto rounded-lg border border-border'>
                <table className='w-full min-w-[32rem] border-collapse text-sm'>
                  <caption className='sr-only'>
                    Notificações de {group.label}: escolha os canais
                  </caption>
                  <thead>
                    <tr className='border-border border-b bg-muted/40'>
                      <th
                        scope='col'
                        className='px-3 py-2 text-left font-medium'
                      >
                        Evento
                      </th>
                      {channels.map((channel) => (
                        <th
                          key={channel.id}
                          scope='col'
                          className='w-28 px-3 py-2 text-center font-medium'
                        >
                          <span className='inline-flex items-center gap-1.5'>
                            <SteelIcon icon={channel.icon} size={14} />
                            {channel.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.events.map((row) => (
                      <tr
                        key={row.event}
                        className='border-border border-b last:border-b-0'
                      >
                        <th
                          scope='row'
                          className='px-3 py-2.5 text-left font-normal'
                        >
                          <span className='block font-medium'>{row.label}</span>
                          <span className='block text-muted-foreground text-xs'>
                            {row.description}
                          </span>
                        </th>
                        {channels.map((channel) => {
                          const offered = row.channels.includes(channel.id)
                          const checked = sdCellChecked(row, channel.id, draft)
                          return (
                            <td
                              key={channel.id}
                              className={cn(
                                'px-3 py-2.5 text-center',
                                !offered && 'text-muted-foreground',
                              )}
                            >
                              {offered ? (
                                <Checkbox
                                  checked={checked}
                                  aria-label={`${row.label} — ${channel.label}`}
                                  onCheckedChange={(next) =>
                                    toggle(row.event, channel.id, next === true)
                                  }
                                />
                              ) : (
                                <span aria-hidden>—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </SettingsSection>
    </div>
  )
}
