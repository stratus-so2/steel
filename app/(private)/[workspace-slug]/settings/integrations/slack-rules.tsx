'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import {
  useWorkspaceIntegrationMutations,
  useWorkspaceSlackChannels,
} from '@/src/hooks/use-workspace-integrations'
import {
  INTEGRATION_EVENT_MODULE_LABEL,
  INTEGRATION_NOTIFICATION_EVENTS,
  type IntegrationEventModule,
  integrationNotificationEvent,
  MAX_WAITING_MINUTES,
  MIN_WAITING_MINUTES,
} from '@/src/lib/integrations/catalog'
import type {
  IntegrationModuleDTO,
  SlackNotificationRouteDTO,
  WorkspaceSlackSettingsDTO,
} from '@/types/workspace-integration'
import { Field, PlainSelect } from './integration-kit'

/**
 * Slack notification rules of the workspace: "when <event> → post in
 * <#channel>", grouped by module. Only the modules enabled in the workspace
 * (plus Steel Agents) are offered. A ServiceDesk rule may target "the
 * team's channel", mapped per team in the ServiceDesk settings.
 */

const TEAM_CHANNEL = '__team__'

function routeKey(route: SlackNotificationRouteDTO): string {
  return `${route.event}|${route.channelId ?? '*'}`
}

function ModuleRules({
  module,
  routes,
  channelOptions,
  channelName,
  disabled,
  onAdd,
  onRemove,
  extra,
}: {
  module: IntegrationEventModule
  routes: SlackNotificationRouteDTO[]
  channelOptions: { value: string; label: string }[]
  channelName: (id: string | null) => string
  disabled: boolean
  onAdd: (route: SlackNotificationRouteDTO) => void
  onRemove: (route: SlackNotificationRouteDTO) => void
  extra?: React.ReactNode
}) {
  const events = INTEGRATION_NOTIFICATION_EVENTS.filter(
    (event) => event.module === module,
  )
  const [event, setEvent] = useState<string | null>(null)
  const [channel, setChannel] = useState<string | null>(null)
  const spec = event ? integrationNotificationEvent(event) : null
  const options = spec?.allowsTeamChannel
    ? [
        { value: TEAM_CHANNEL, label: 'Canal do time (ServiceDesk)' },
        ...channelOptions,
      ]
    : channelOptions
  const label = INTEGRATION_EVENT_MODULE_LABEL[module]

  return (
    <section
      aria-label={`Regras de ${label}`}
      className='flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3'
    >
      <h4 className='font-medium text-sm'>{label}</h4>
      {routes.length === 0 ? (
        <p className='text-muted-foreground text-xs'>
          Nenhuma regra: nada deste módulo vai para o Slack.
        </p>
      ) : (
        <ul className='flex flex-col gap-1.5'>
          {routes.map((route) => (
            <li
              key={routeKey(route)}
              className='flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5'
            >
              <span className='min-w-0 text-xs'>
                <span className='break-words'>
                  {integrationNotificationEvent(route.event)?.label ??
                    route.event}
                </span>
                <span className='text-muted-foreground'> → </span>
                <span className='font-medium break-all'>
                  {channelName(route.channelId)}
                </span>
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                aria-label={`Remover regra ${integrationNotificationEvent(route.event)?.label ?? route.event}`}
                disabled={disabled}
                className='shrink-0 text-muted-foreground hover:text-destructive'
                onClick={() => onRemove(route)}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className='grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] md:items-end'>
        <Field label='Quando'>
          <PlainSelect
            ariaLabel={`Evento de ${label}`}
            value={event}
            onChange={(value) => {
              setEvent(value)
              setChannel(null)
            }}
            options={events.map((item) => ({
              value: item.key,
              label:
                module === 'SERVICE_DESK' && item.group !== 'Chamados'
                  ? `${item.group} · ${item.label}`
                  : item.label,
            }))}
            placeholder='Escolha o evento'
            disabled={disabled}
          />
        </Field>
        <Field label='Enviar para'>
          <PlainSelect
            ariaLabel={`Canal de ${label}`}
            value={channel}
            onChange={setChannel}
            options={options}
            placeholder='Escolha o canal'
            disabled={disabled || !event}
          />
        </Field>
        <Button
          type='button'
          variant='outline'
          disabled={disabled || !event || !channel}
          onClick={() => {
            if (!event || !channel) return
            onAdd({
              event,
              channelId: channel === TEAM_CHANNEL ? null : channel,
              channelName:
                channel === TEAM_CHANNEL ? null : channelName(channel).slice(1),
            })
            setEvent(null)
            setChannel(null)
          }}
        >
          <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
          Adicionar
        </Button>
      </div>
      {extra}
    </section>
  )
}

function WaitingMinutes({
  value,
  disabled,
  onSave,
}: {
  value: number
  disabled: boolean
  onSave: (minutes: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const parsed = Number(draft)
  const valid =
    Number.isInteger(parsed) &&
    parsed >= MIN_WAITING_MINUTES &&
    parsed <= MAX_WAITING_MINUTES
  return (
    <Field
      id='slack-waiting-minutes'
      label='Considerar "aguardando há muito tempo" depois de (minutos)'
      hint={`Entre ${MIN_WAITING_MINUTES} minutos e 24 horas. Cada conversa é avisada uma vez por mensagem sem resposta.`}
    >
      <div className='flex items-center gap-2'>
        <Input
          id='slack-waiting-minutes'
          type='number'
          inputMode='numeric'
          min={MIN_WAITING_MINUTES}
          max={MAX_WAITING_MINUTES}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
          className='w-28'
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled || !valid || parsed === value}
          onClick={() => onSave(parsed)}
        >
          Salvar
        </Button>
      </div>
    </Field>
  )
}

export function SlackRules({
  workspaceId,
  settings,
  enabledModules,
}: {
  workspaceId: string
  settings: WorkspaceSlackSettingsDTO
  enabledModules: IntegrationModuleDTO[]
}) {
  const channels = useWorkspaceSlackChannels(workspaceId, { enabled: true })
  const { updateSlack } = useWorkspaceIntegrationMutations(workspaceId)
  const routes = settings.routes

  const channelOptions = (channels.data ?? []).map((channel) => ({
    value: channel.id,
    label: `#${channel.name}${channel.isPrivate ? ' (privado)' : ''}`,
  }))
  const channelName = (id: string | null): string => {
    if (id === null) return 'canal do time'
    const fromApi = channels.data?.find((channel) => channel.id === id)
    if (fromApi) return `#${fromApi.name}`
    const fromRoute = routes.find((route) => route.channelId === id)
    return fromRoute?.channelName ? `#${fromRoute.channelName}` : id
  }

  function save(next: SlackNotificationRouteDTO[], message: string) {
    updateSlack.mutate(
      { routes: next },
      {
        onSuccess: () => notify.success(message),
        onError: (error) => notify.error(error.message),
      },
    )
  }

  const modules: IntegrationEventModule[] = [...enabledModules, 'AGENTS']
  const disabled = updateSlack.isPending

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <div>
        <h3 className='font-medium text-sm'>Notificações no Slack</h3>
        <p className='text-muted-foreground text-xs'>
          Escolha, por módulo, quais eventos vão para qual canal. O bot precisa
          estar no canal (<code>/invite @Steel</code>) para canais privados.
        </p>
      </div>
      {channels.isLoading ? (
        <p className='text-muted-foreground text-xs'>Carregando canais…</p>
      ) : channels.error ? (
        <p className='text-destructive text-xs'>{channels.error.message}</p>
      ) : null}
      {modules.map((module) => (
        <ModuleRules
          key={module}
          module={module}
          routes={routes.filter(
            (route) =>
              integrationNotificationEvent(route.event)?.module === module,
          )}
          channelOptions={channelOptions}
          channelName={channelName}
          disabled={disabled}
          onAdd={(route) => {
            if (routes.some((r) => routeKey(r) === routeKey(route))) {
              notify.error('Essa regra já existe')
              return
            }
            save([...routes, route], 'Regra adicionada')
          }}
          onRemove={(route) =>
            save(
              routes.filter((r) => routeKey(r) !== routeKey(route)),
              'Regra removida',
            )
          }
          extra={
            module === 'COMMUNICATION' ? (
              <WaitingMinutes
                value={settings.waitingMinutes}
                disabled={disabled}
                onSave={(minutes) =>
                  updateSlack.mutate(
                    { waitingMinutes: minutes },
                    {
                      onSuccess: () => notify.success('Tempo de espera salvo'),
                      onError: (error) => notify.error(error.message),
                    },
                  )
                }
              />
            ) : null
          }
        />
      ))}
    </div>
  )
}
