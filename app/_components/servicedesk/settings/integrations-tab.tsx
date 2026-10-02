'use client'

import {
  Alert02Icon,
  Copy01Icon,
  GithubIcon,
  Link04Icon,
  PlusSignIcon,
  SlackIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import {
  SD_NOTIFICATION_EVENTS,
  SD_NOTIFICATION_GROUPS,
} from '@/src/config/servicedesk-notifications'
import {
  sdSlackConnectUrl,
  useSdIntegrationMutations,
  useSdIntegrations,
  useSdSlackChannels,
} from '@/src/hooks/use-sd-integrations'
import type {
  SdIntegrationDTO,
  SdSlackChannelMapDTO,
} from '@/types/sd-integration'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  SD_TICKET_TYPE_OPTIONS,
  SettingsSection,
  SimpleSelect,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "Integrações" das configurações do ServiceDesk: conectar/desconectar o
 * Slack (OAuth) e o GitHub (repositório + token), mapear o canal de cada
 * time e escolher os eventos que vão para o Slack.
 *
 * Token e segredo só entram: nenhuma resposta da API os devolve, então a
 * tela nunca tem como mostrá-los.
 */

/** Eventos do catálogo oferecidos ao Slack (os de chamado, com público). */
const SLACK_EVENT_GROUPS = SD_NOTIFICATION_GROUPS.filter(
  (group) => group.label !== 'Resumos',
)

const EVENT_LABEL = new Map(
  SD_NOTIFICATION_EVENTS.map((event) => [event.key, event.label]),
)

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <FieldBlock label={label}>
      <div className='flex items-center gap-2'>
        <Input readOnly value={value} className='font-mono text-xs' />
        <Button
          type='button'
          variant='outline'
          size='icon'
          aria-label={`Copiar ${label}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value)
            notify.success('Copiado')
          }}
        >
          <SteelIcon icon={Copy01Icon} strokeWidth={2} />
        </Button>
      </div>
    </FieldBlock>
  )
}

function StatusBadge({ integration }: { integration: SdIntegrationDTO }) {
  if (integration.status === 'ERROR') {
    return (
      <Badge variant='destructive' className='gap-1'>
        <SteelIcon icon={Alert02Icon} strokeWidth={2} className='size-3' />
        Com erro
      </Badge>
    )
  }
  return <Badge variant='outline'>Conectado</Badge>
}

/* ----------------------------------- Slack ----------------------------------- */

function SlackSection() {
  const { workspaceId, canEdit, config } = useSdSettingsContext()
  const { data } = useSdIntegrations(workspaceId)
  const { updateSlack, disconnectSlack } =
    useSdIntegrationMutations(workspaceId)
  const integration = data?.slack ?? null
  const slack = integration?.slack ?? null
  const channels = useSdSlackChannels(workspaceId, {
    enabled: Boolean(integration),
  })

  const departments = (config?.departments ?? []).flatMap((department) => [
    { id: department.id, name: department.name },
    ...department.children.map((child) => ({
      id: child.id,
      name: `${department.name} › ${child.name}`,
    })),
  ])

  const channelOptions = (channels.data ?? []).map((channel) => ({
    value: channel.id,
    label: `#${channel.name}${channel.isPrivate ? ' (privado)' : ''}`,
  }))

  function saveChannels(rows: SdSlackChannelMapDTO[]) {
    updateSlack.mutate(
      { channels: rows },
      {
        onSuccess: () => notify.success('Canais salvos'),
        onError: (error) => notify.error(error.message),
      },
    )
  }

  function setChannel(departmentId: string | null, channelId: string | null) {
    const current = slack?.channels ?? []
    const rows = current.filter((row) => row.departmentId !== departmentId)
    if (channelId) {
      const channel = channels.data?.find((c) => c.id === channelId)
      rows.push({
        departmentId,
        channelId,
        channelName: channel?.name ?? null,
      })
    }
    saveChannels(rows)
  }

  function toggleEvent(key: string, enabled: boolean) {
    const current = slack?.events ?? []
    const events = enabled
      ? [...new Set([...current, key])]
      : current.filter((event) => event !== key)
    updateSlack.mutate(
      { events },
      {
        onSuccess: () => notify.success('Eventos salvos'),
        onError: (error) => notify.error(error.message),
      },
    )
  }

  if (!data) return null

  if (!data.slackConfigured) {
    return (
      <SettingsSection
        title='Slack'
        description='Avisos no canal do time, abertura de chamado a partir de uma mensagem e respostas da thread no histórico do chamado.'
      >
        <EmptyState>
          O app do Slack não está configurado neste servidor. Defina
          <code className='mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]'>
            SLACK_CLIENT_ID
          </code>
          ,
          <code className='mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]'>
            SLACK_CLIENT_SECRET
          </code>
          e
          <code className='mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]'>
            SLACK_SIGNING_SECRET
          </code>
          no ambiente e recarregue esta página. Até lá a integração fica inerte:
          nada é enviado nem recebido.
        </EmptyState>
      </SettingsSection>
    )
  }

  if (!integration) {
    return (
      <SettingsSection
        title='Slack'
        description='Avisos no canal do time, abertura de chamado a partir de uma mensagem e respostas da thread no histórico do chamado.'
        actions={
          canEdit ? (
            <a
              href={sdSlackConnectUrl(workspaceId)}
              className={buttonVariants()}
            >
              <SteelIcon icon={SlackIcon} strokeWidth={2} />
              Conectar o Slack
            </a>
          ) : null
        }
      >
        <EmptyState>
          Nenhum workspace do Slack conectado. No app do Slack, cadastre a URL
          abaixo em <strong>Event Subscriptions</strong> e em{' '}
          <strong>Interactivity &amp; Shortcuts</strong>.
        </EmptyState>
        {data.slackEventsUrl ? (
          <CopyField label='Request URL do Slack' value={data.slackEventsUrl} />
        ) : null}
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title='Slack'
      description='Avisos no canal do time, abertura de chamado a partir de uma mensagem e respostas da thread no histórico do chamado.'
      actions={
        <div className='flex items-center gap-2'>
          <StatusBadge integration={integration} />
          <ConfirmDeleteButton
            label='Desconectar'
            iconOnly={false}
            disabled={!canEdit || disconnectSlack.isPending}
            pending={disconnectSlack.isPending}
            title='Desconectar o Slack?'
            description='Os avisos param na hora e as threads deixam de alimentar os chamados. As mensagens já registradas ficam no histórico.'
            onConfirm={() =>
              disconnectSlack.mutate(undefined, {
                onSuccess: () => notify.success('Slack desconectado'),
                onError: (error) => notify.error(error.message),
              })
            }
          />
        </div>
      }
    >
      <div className='flex flex-col gap-1'>
        <p className='text-sm'>
          Conectado a{' '}
          <strong>{integration.externalName ?? integration.externalId}</strong>
        </p>
        {integration.statusError ? (
          <p className='text-destructive text-xs'>{integration.statusError}</p>
        ) : null}
      </div>

      {data.slackEventsUrl ? (
        <CopyField label='Request URL do Slack' value={data.slackEventsUrl} />
      ) : null}

      <div className='flex flex-col gap-3'>
        <h4 className='font-medium text-sm'>Canal por time</h4>
        {channels.isLoading ? (
          <p className='text-muted-foreground text-xs'>Carregando canais…</p>
        ) : channels.error ? (
          <p className='text-destructive text-xs'>{channels.error.message}</p>
        ) : channelOptions.length === 0 ? (
          <EmptyState>
            O bot não enxerga nenhum canal. Convide-o nos canais que devem
            receber os avisos (<code>/invite @ServiceDesk</code>).
          </EmptyState>
        ) : (
          <div className='flex flex-col gap-2'>
            <div className='grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center'>
              <span className='text-muted-foreground text-xs'>
                Canal padrão (qualquer time)
              </span>
              <SimpleSelect
                value={
                  slack?.channels.find((row) => row.departmentId === null)
                    ?.channelId ?? null
                }
                onChange={(value) => setChannel(null, value)}
                options={channelOptions}
                allowEmpty
                emptyLabel='Sem canal'
                disabled={!canEdit || updateSlack.isPending}
              />
            </div>
            {departments.map((department) => (
              <div
                key={department.id}
                className='grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center'
              >
                <span className='text-muted-foreground text-xs'>
                  {department.name}
                </span>
                <SimpleSelect
                  value={
                    slack?.channels.find(
                      (row) => row.departmentId === department.id,
                    )?.channelId ?? null
                  }
                  onChange={(value) => setChannel(department.id, value)}
                  options={channelOptions}
                  allowEmpty
                  emptyLabel='Usar o canal padrão'
                  disabled={!canEdit || updateSlack.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='flex flex-col gap-3'>
        <h4 className='font-medium text-sm'>Eventos enviados ao canal</h4>
        {SLACK_EVENT_GROUPS.map((group) => (
          <div key={group.label} className='flex flex-col gap-1'>
            <span className='text-muted-foreground text-xs'>{group.label}</span>
            {group.events.map((key) => (
              <ToggleRow
                key={key}
                label={EVENT_LABEL.get(key) ?? key}
                checked={(slack?.events ?? []).includes(key)}
                onCheckedChange={(enabled) => toggleEvent(key, enabled)}
                disabled={!canEdit || updateSlack.isPending}
              />
            ))}
          </div>
        ))}
      </div>

      <div className='flex flex-col gap-2'>
        <h4 className='font-medium text-sm'>Chamado a partir do Slack</h4>
        <ToggleRow
          label='Abrir chamado por atalho de mensagem e slash command'
          description='O atalho usa a mensagem como descrição e responde na thread com o código do chamado.'
          checked={slack?.allowTicketFromMessage ?? false}
          onCheckedChange={(enabled) =>
            updateSlack.mutate(
              { allowTicketFromMessage: enabled },
              { onError: (error) => notify.error(error.message) },
            )
          }
          disabled={!canEdit || updateSlack.isPending}
        />
        <ToggleRow
          label='Respostas da thread entram no histórico'
          description='A resposta vira mensagem pública do chamado, com o autor casado pelo e-mail do Slack.'
          checked={slack?.mirrorThreadReplies ?? false}
          onCheckedChange={(enabled) =>
            updateSlack.mutate(
              { mirrorThreadReplies: enabled },
              { onError: (error) => notify.error(error.message) },
            )
          }
          disabled={!canEdit || updateSlack.isPending}
        />
        <div className='grid gap-3 sm:grid-cols-2'>
          <FieldBlock label='Tipo do chamado aberto pelo Slack'>
            <SimpleSelect
              value={slack?.ticketType ?? 'INCIDENT'}
              onChange={(value) =>
                value &&
                updateSlack.mutate(
                  { ticketType: value },
                  { onError: (error) => notify.error(error.message) },
                )
              }
              options={SD_TICKET_TYPE_OPTIONS}
              disabled={!canEdit || updateSlack.isPending}
            />
          </FieldBlock>
          <FieldBlock label='Time que recebe'>
            <SimpleSelect
              value={slack?.departmentId ?? null}
              onChange={(value) =>
                updateSlack.mutate(
                  { departmentId: value },
                  { onError: (error) => notify.error(error.message) },
                )
              }
              options={departments.map((d) => ({
                value: d.id,
                label: d.name,
              }))}
              allowEmpty
              emptyLabel='Roteamento padrão'
              disabled={!canEdit || updateSlack.isPending}
            />
          </FieldBlock>
        </div>
      </div>
    </SettingsSection>
  )
}

/* ----------------------------------- GitHub ----------------------------------- */

function GithubSection() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data } = useSdIntegrations(workspaceId)
  const { connectGithub, updateGithub, disconnectGithub } =
    useSdIntegrationMutations(workspaceId)
  const integration = data?.github ?? null
  const github = integration?.github ?? null

  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')

  if (!data) return null

  function connect() {
    connectGithub.mutate(
      {
        repo,
        token,
        webhookSecret: secret || null,
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      },
      {
        onSuccess: () => {
          setRepo('')
          setToken('')
          setSecret('')
          notify.success('Repositório conectado')
        },
        onError: (error) => notify.error(error.message),
      },
    )
  }

  return (
    <SettingsSection
      title='GitHub'
      description='Vincule issues e pull requests a chamados de problema e mudança; o estado (fechada, reaberta, mesclada) é espelhado no chamado.'
      actions={
        integration ? (
          <div className='flex items-center gap-2'>
            <StatusBadge integration={integration} />
            <ConfirmDeleteButton
              label='Desconectar'
              iconOnly={false}
              disabled={!canEdit || disconnectGithub.isPending}
              pending={disconnectGithub.isPending}
              title='Desconectar o GitHub?'
              description='O espelhamento de estado para na hora. Os vínculos já registrados ficam no histórico dos chamados.'
              onConfirm={() =>
                disconnectGithub.mutate(undefined, {
                  onSuccess: () => notify.success('GitHub desconectado'),
                  onError: (error) => notify.error(error.message),
                })
              }
            />
          </div>
        ) : null
      }
    >
      <CopyField
        label='URL do webhook do repositório'
        value={data.githubWebhookUrl}
      />

      {integration ? (
        <>
          <div className='flex flex-col gap-1'>
            <p className='flex items-center gap-2 text-sm'>
              <SteelIcon icon={GithubIcon} strokeWidth={2} />
              <strong>
                {integration.externalName ?? integration.externalId}
              </strong>
              {integration.hasWebhookSecret ? (
                <Badge variant='outline'>Webhook assinado</Badge>
              ) : (
                <Badge variant='destructive'>Sem segredo de webhook</Badge>
              )}
            </p>
            {integration.statusError ? (
              <p className='text-destructive text-xs'>
                {integration.statusError}
              </p>
            ) : null}
            {integration.hasWebhookSecret ? null : (
              <p className='text-muted-foreground text-xs'>
                Sem segredo, o webhook é recusado. Gere um (
                <code>openssl rand -hex 24</code>), cadastre no repositório e
                salve abaixo.
              </p>
            )}
          </div>

          <ToggleRow
            label='Fechar a issue sugere avançar a fase'
            description='O chamado recebe uma mensagem sugerindo a mudança — quem move a fase é o agente (em ITIL o encerramento exige solução e classificação).'
            checked={github?.suggestPhaseOnClose ?? true}
            onCheckedChange={(enabled) =>
              updateGithub.mutate(
                { suggestPhaseOnClose: enabled },
                { onError: (error) => notify.error(error.message) },
              )
            }
            disabled={!canEdit || updateGithub.isPending}
          />
          <ToggleRow
            label='Abrir issue a partir do chamado'
            description='Disponível na tela de chamados de problema e mudança.'
            checked={github?.allowIssueFromTicket ?? true}
            onCheckedChange={(enabled) =>
              updateGithub.mutate(
                { allowIssueFromTicket: enabled },
                { onError: (error) => notify.error(error.message) },
              )
            }
            disabled={!canEdit || updateGithub.isPending}
          />

          <div className='grid gap-3 sm:grid-cols-2'>
            <FieldBlock
              label='Trocar o token'
              hint='PAT fine-grained com Issues: read & write no repositório.'
            >
              <div className='flex items-center gap-2'>
                <Input
                  aria-label='Trocar o token'
                  type='password'
                  autoComplete='off'
                  placeholder='github_pat_…'
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  disabled={!canEdit}
                />
                <Button
                  type='button'
                  variant='outline'
                  disabled={!canEdit || token.length < 20}
                  onClick={() =>
                    updateGithub.mutate(
                      { token },
                      {
                        onSuccess: () => {
                          setToken('')
                          notify.success('Token trocado')
                        },
                        onError: (error) => notify.error(error.message),
                      },
                    )
                  }
                >
                  Salvar
                </Button>
              </div>
            </FieldBlock>
            <FieldBlock
              label='Trocar o segredo do webhook'
              hint='O mesmo valor cadastrado em Settings › Webhooks do repositório.'
            >
              <div className='flex items-center gap-2'>
                <Input
                  aria-label='Trocar o segredo do webhook'
                  type='password'
                  autoComplete='off'
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  disabled={!canEdit}
                />
                <Button
                  type='button'
                  variant='outline'
                  disabled={!canEdit || secret.length < 16}
                  onClick={() =>
                    updateGithub.mutate(
                      { webhookSecret: secret },
                      {
                        onSuccess: () => {
                          setSecret('')
                          notify.success('Segredo trocado')
                        },
                        onError: (error) => notify.error(error.message),
                      },
                    )
                  }
                >
                  Salvar
                </Button>
              </div>
            </FieldBlock>
          </div>
        </>
      ) : (
        <div className='flex flex-col gap-3'>
          <div className='grid gap-3 sm:grid-cols-3'>
            <FieldBlock label='Repositório' hint='`owner/repo` ou a URL'>
              <Input
                aria-label='Repositório'
                placeholder='stratus-so2/steel'
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock
              label='Token'
              hint='PAT fine-grained com Issues: read & write'
            >
              <Input
                aria-label='Token'
                type='password'
                autoComplete='off'
                placeholder='github_pat_…'
                value={token}
                onChange={(event) => setToken(event.target.value)}
                disabled={!canEdit}
              />
            </FieldBlock>
            <FieldBlock label='Segredo do webhook' hint='openssl rand -hex 24'>
              <Input
                aria-label='Segredo do webhook'
                type='password'
                autoComplete='off'
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                disabled={!canEdit}
              />
            </FieldBlock>
          </div>
          <div>
            <Button
              type='button'
              disabled={
                !canEdit ||
                connectGithub.isPending ||
                repo.trim().length < 3 ||
                token.trim().length < 20
              }
              onClick={connect}
            >
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Conectar o repositório
            </Button>
          </div>
        </div>
      )}
    </SettingsSection>
  )
}

export function SdIntegrationsTab() {
  const { workspaceId } = useSdSettingsContext()
  const { isLoading, error } = useSdIntegrations(workspaceId)

  if (isLoading) {
    return (
      <p className='text-muted-foreground text-sm'>Carregando integrações…</p>
    )
  }
  if (error) {
    return <p className='text-destructive text-sm'>{error.message}</p>
  }

  return (
    <div className='flex flex-col gap-5'>
      <p className='flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-muted-foreground text-xs'>
        <SteelIcon icon={Link04Icon} strokeWidth={2} className='mt-0.5' />
        Os tokens ficam cifrados no banco e nunca voltam por aqui — nem
        mascarados. Para trocar, cadastre um valor novo.
      </p>
      <SlackSection />
      <GithubSection />
    </div>
  )
}
