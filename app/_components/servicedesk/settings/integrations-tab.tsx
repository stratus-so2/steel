'use client'

import {
  Alert02Icon,
  GithubIcon,
  GitlabIcon,
  Link04Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import {
  useSdIntegrationMutations,
  useSdIntegrations,
  useSdSlackChannels,
} from '@/src/hooks/use-sd-integrations'
import type {
  SdIntegrationDTO,
  SdRepoProviderDTO,
  SdSlackChannelMapDTO,
} from '@/types/sd-integration'
import {
  EmptyState,
  FieldBlock,
  SD_TICKET_TYPE_OPTIONS,
  SettingsSection,
  SimpleSelect,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * "Integrações" tab of the ServiceDesk settings. Since ADR 0024 the Slack,
 * GitHub and GitLab connections — and the Slack notification rules — are
 * workspace-level (Ajustes > Integrações, OWNER/ADMIN). This tab shows the
 * connection state and edits only what is ServiceDesk-specific: the Slack
 * channel per team, ticket from a Slack message, thread mirroring and, per
 * repository provider, the phase suggestion and "open issue".
 */

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

function ManageLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      <SteelIcon icon={Link04Icon} strokeWidth={2} />
      {label}
    </Link>
  )
}

/* ----------------------------------- Slack ----------------------------------- */

function SlackSection() {
  const { workspaceId, canEdit, config } = useSdSettingsContext()
  const { data } = useSdIntegrations(workspaceId)
  const { updateSlack } = useSdIntegrationMutations(workspaceId)
  const integration = data?.slack ?? null
  const slack = integration?.slack ?? null
  const channels = useSdSlackChannels(workspaceId, {
    enabled: Boolean(integration),
  })

  if (!data) return null

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

  function setChannel(departmentId: string, channelId: string | null) {
    const rows = (slack?.channels ?? []).filter(
      (row): row is SdSlackChannelMapDTO & { departmentId: string } =>
        row.departmentId !== null && row.departmentId !== departmentId,
    )
    if (channelId) {
      const channel = channels.data?.find((c) => c.id === channelId)
      rows.push({ departmentId, channelId, channelName: channel?.name ?? null })
    }
    updateSlack.mutate(
      { channels: rows },
      {
        onSuccess: () => notify.success('Canais salvos'),
        onError: (error) => notify.error(error.message),
      },
    )
  }

  const description =
    'Canal por time, abertura de chamado a partir de uma mensagem e respostas da thread no histórico do chamado.'

  if (!integration) {
    return (
      <SettingsSection
        title='Slack'
        description={description}
        actions={
          <ManageLink
            href={data.manageHref}
            label='Conectar em Ajustes › Integrações'
          />
        }
      >
        <EmptyState>
          {data.slackConfigured
            ? 'O Slack ainda não foi conectado neste workspace. A conexão e as regras de notificação ficam em Ajustes › Integrações (dono e administradores).'
            : 'O app do Slack não está configurado neste servidor. Até lá a integração fica desligada: nada é enviado nem recebido.'}
        </EmptyState>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title='Slack'
      description={description}
      actions={
        <div className='flex flex-wrap items-center gap-2'>
          <StatusBadge integration={integration} />
          <ManageLink href={data.manageHref} label='Gerenciar conexão' />
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
        <p className='text-muted-foreground text-xs'>
          Quais eventos vão para o Slack (e o canal padrão) é definido nas
          regras de notificação em Ajustes › Integrações.
        </p>
      </div>

      <div className='flex flex-col gap-3'>
        <h4 className='font-medium text-sm'>Canal por time</h4>
        <p className='text-muted-foreground text-xs'>
          Quando o chamado é de um time com canal, o aviso vai para o canal do
          time em vez do canal da regra.
        </p>
        {channels.isLoading ? (
          <p className='text-muted-foreground text-xs'>Carregando canais…</p>
        ) : channels.error ? (
          <p className='text-destructive text-xs'>{channels.error.message}</p>
        ) : departments.length === 0 ? (
          <EmptyState>Nenhum time cadastrado.</EmptyState>
        ) : (
          <div className='flex flex-col gap-2'>
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
                  emptyLabel='Usar o canal da regra'
                  disabled={!canEdit || updateSlack.isPending}
                />
              </div>
            ))}
          </div>
        )}
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
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
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

/* ----------------------------- GitHub and GitLab ----------------------------- */

const REPO_COPY: Record<
  SdRepoProviderDTO,
  { title: string; description: string; icon: typeof GithubIcon }
> = {
  GITHUB: {
    title: 'GitHub',
    description:
      'Issues e pull requests vinculados a chamados de problema e mudança; o estado (fechada, reaberta, mesclada) é espelhado no chamado.',
    icon: GithubIcon,
  },
  GITLAB: {
    title: 'GitLab',
    description:
      'Issues e merge requests vinculados a chamados de problema e mudança, no gitlab.com ou numa instância própria.',
    icon: GitlabIcon,
  },
}

function RepoSection({ provider }: { provider: SdRepoProviderDTO }) {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data } = useSdIntegrations(workspaceId)
  const { updateRepo } = useSdIntegrationMutations(workspaceId)
  if (!data) return null

  const copy = REPO_COPY[provider]
  const integration = provider === 'GITHUB' ? data.github : data.gitlab
  if (!integration) {
    return (
      <SettingsSection
        title={copy.title}
        description={copy.description}
        actions={
          <ManageLink
            href={data.manageHref}
            label='Conectar em Ajustes › Integrações'
          />
        }
      >
        <EmptyState>
          Nenhum {provider === 'GITHUB' ? 'repositório' : 'projeto'} conectado.
          A conexão (token e segredo do webhook) fica em Ajustes › Integrações.
        </EmptyState>
      </SettingsSection>
    )
  }

  const repo = integration.repo
  return (
    <SettingsSection
      title={copy.title}
      description={copy.description}
      actions={
        <div className='flex flex-wrap items-center gap-2'>
          <StatusBadge integration={integration} />
          <ManageLink href={data.manageHref} label='Gerenciar conexão' />
        </div>
      }
    >
      <div className='flex flex-col gap-1'>
        <p className='flex flex-wrap items-center gap-2 text-sm'>
          <SteelIcon icon={copy.icon} strokeWidth={2} />
          <strong className='break-all'>
            {integration.externalName ?? integration.externalId}
          </strong>
          {integration.hasWebhookSecret ? (
            <Badge variant='outline'>Webhook assinado</Badge>
          ) : (
            <Badge variant='destructive'>Sem segredo de webhook</Badge>
          )}
        </p>
        {integration.statusError ? (
          <p className='text-destructive text-xs'>{integration.statusError}</p>
        ) : null}
      </div>
      <ToggleRow
        label='Fechar a issue sugere avançar a fase'
        description='O chamado recebe uma mensagem sugerindo a mudança — quem move a fase é o agente (em ITIL o encerramento exige solução e classificação).'
        checked={repo?.suggestPhaseOnClose ?? true}
        onCheckedChange={(enabled) =>
          updateRepo.mutate(
            { provider, suggestPhaseOnClose: enabled },
            { onError: (error) => notify.error(error.message) },
          )
        }
        disabled={!canEdit || updateRepo.isPending}
      />
      <ToggleRow
        label='Abrir issue a partir do chamado'
        description='Disponível na tela de chamados de problema e mudança.'
        checked={repo?.allowIssueFromTicket ?? true}
        onCheckedChange={(enabled) =>
          updateRepo.mutate(
            { provider, allowIssueFromTicket: enabled },
            { onError: (error) => notify.error(error.message) },
          )
        }
        disabled={!canEdit || updateRepo.isPending}
      />
    </SettingsSection>
  )
}

export function SdIntegrationsTab() {
  const { workspaceId } = useSdSettingsContext()
  const { data, isLoading, error } = useSdIntegrations(workspaceId)

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
        <span>
          As conexões com Slack, GitHub e GitLab valem para o workspace inteiro
          e são gerenciadas em{' '}
          {data?.manageHref ? (
            <Link href={data.manageHref} className='underline'>
              Ajustes › Integrações
            </Link>
          ) : (
            'Ajustes › Integrações'
          )}
          . Aqui ficam só as configurações do ServiceDesk.
        </span>
      </p>
      <SlackSection />
      <RepoSection provider='GITHUB' />
      <RepoSection provider='GITLAB' />
    </div>
  )
}
