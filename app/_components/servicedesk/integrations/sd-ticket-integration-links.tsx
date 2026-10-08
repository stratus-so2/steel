'use client'

import {
  Delete02Icon,
  GithubIcon,
  GitlabIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  Link04Icon,
  PlusSignIcon,
  SlackIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useSdIntegrationLinkMutations,
  useSdIntegrationLinks,
  useSdRepoProviders,
} from '@/src/hooks/use-sd-integrations'
import type {
  SdIntegrationLinkDTO,
  SdIntegrationLinkKindDTO,
  SdRepoProviderDTO,
} from '@/types/sd-integration'
import type { SdTicketDTO } from '@/types/sd-ticket'

/**
 * "Integrações" block of the ticket screen: the Slack thread that opened the
 * ticket and the linked GitHub issues/PRs and GitLab issues/MRs, with the
 * state mirrored by webhook.
 *
 * Agents only (the route is `agentOnly`), so for the requester the block
 * does not render. Linking and opening an issue show up on **problem and
 * change** tickets, for the repository providers connected to the workspace
 * (Ajustes > Integrações).
 */

const KIND_ICON: Record<SdIntegrationLinkKindDTO, typeof SlackIcon> = {
  SLACK_THREAD: SlackIcon,
  GITHUB_ISSUE: GithubIcon,
  GITHUB_PULL_REQUEST: GitPullRequestIcon,
  GITLAB_ISSUE: GitlabIcon,
  GITLAB_MERGE_REQUEST: GitMergeIcon,
}

const KIND_LABEL: Record<SdIntegrationLinkKindDTO, string> = {
  SLACK_THREAD: 'Thread do Slack',
  GITHUB_ISSUE: 'Issue do GitHub',
  GITHUB_PULL_REQUEST: 'Pull request',
  GITLAB_ISSUE: 'Issue do GitLab',
  GITLAB_MERGE_REQUEST: 'Merge request',
}

const PROVIDER_LABEL: Record<SdRepoProviderDTO, string> = {
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
}

function stateVariant(
  state: string | null,
): 'outline' | 'secondary' | 'destructive' {
  if (state === 'merged') return 'secondary'
  if (state === 'closed') return 'destructive'
  return 'outline'
}

function LinkRow({
  link,
  onUnlink,
  pending,
}: {
  link: SdIntegrationLinkDTO
  onUnlink: () => void
  pending: boolean
}) {
  const label = link.title ?? link.externalKey
  return (
    <li className='flex items-start justify-between gap-2'>
      <span className='flex min-w-0 items-start gap-2'>
        <SteelIcon
          icon={KIND_ICON[link.kind]}
          strokeWidth={2}
          className='mt-0.5 size-4 shrink-0 text-muted-foreground'
        />
        <span className='flex min-w-0 flex-col gap-0.5'>
          {link.externalUrl ? (
            <a
              href={link.externalUrl}
              target='_blank'
              rel='noreferrer'
              className='truncate text-xs underline-offset-2 hover:underline'
            >
              {label}
            </a>
          ) : (
            <span className='truncate text-xs'>{label}</span>
          )}
          <span className='text-[11px] text-muted-foreground'>
            {KIND_LABEL[link.kind]}
            {link.kind === 'SLACK_THREAD' ? '' : ` · ${link.externalKey}`}
          </span>
        </span>
      </span>
      <span className='flex shrink-0 items-center gap-1'>
        {link.externalStateLabel ? (
          <Badge variant={stateVariant(link.externalState)}>
            {link.externalStateLabel}
          </Badge>
        ) : null}
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          aria-label={`Desvincular ${link.externalKey}`}
          disabled={pending}
          className='text-muted-foreground hover:text-destructive'
          onClick={onUnlink}
        >
          <SteelIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </span>
    </li>
  )
}

export function SdTicketIntegrationLinks({
  workspaceId,
  ticket,
  mode,
  className,
}: {
  workspaceId: string
  ticket: SdTicketDTO
  mode: 'agent' | 'requester'
  /** Frame tweak (the ticket screen renders it borderless). */
  className?: string
}) {
  const enabled = mode === 'agent'
  const technical = ticket.type === 'PROBLEM' || ticket.type === 'CHANGE'
  const { data } = useSdIntegrationLinks(workspaceId, ticket.id, { enabled })
  const providers = useSdRepoProviders(workspaceId, ticket.id, {
    enabled: enabled && technical,
  })
  const { link, createIssue, unlink } = useSdIntegrationLinkMutations(
    workspaceId,
    ticket.id,
  )
  const [ref, setRef] = useState('')
  const [chosen, setChosen] = useState<SdRepoProviderDTO | null>(null)

  if (!enabled) return null

  const links = data ?? []
  if (links.length === 0 && !technical) return null

  const options = providers.data ?? []
  const selected =
    options.find((option) => option.provider === chosen) ?? options[0] ?? null

  return (
    <section
      aria-label='Integrações do chamado'
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-card p-3',
        className,
      )}
    >
      <header className='flex items-center gap-1.5 font-medium text-sm'>
        <SteelIcon icon={Link04Icon} strokeWidth={2} />
        Integrações
      </header>

      {links.length === 0 ? (
        <p className='text-muted-foreground text-xs'>
          Nenhuma issue, pull request ou merge request vinculado.
        </p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {links.map((item) => (
            <LinkRow
              key={item.id}
              link={item}
              pending={unlink.isPending}
              onUnlink={() =>
                unlink.mutate(item.id, {
                  onSuccess: () => notify.success('Vínculo removido'),
                  onError: (error) => notify.error(error.message),
                })
              }
            />
          ))}
        </ul>
      )}

      {technical && providers.isSuccess && options.length === 0 ? (
        <p className='border-border border-t pt-2 text-muted-foreground text-xs'>
          Nenhum repositório conectado. A conexão com GitHub ou GitLab fica em
          Ajustes › Integrações.
        </p>
      ) : null}

      {technical && selected ? (
        <div className='flex flex-col gap-2 border-border border-t pt-2'>
          {options.length > 1 ? (
            <div
              role='radiogroup'
              aria-label='Repositório'
              className='flex flex-wrap gap-1'
            >
              {options.map((option) => (
                <Button
                  key={option.provider}
                  type='button'
                  size='xs'
                  role='radio'
                  aria-checked={option.provider === selected.provider}
                  variant={
                    option.provider === selected.provider
                      ? 'secondary'
                      : 'ghost'
                  }
                  onClick={() => setChosen(option.provider)}
                >
                  {PROVIDER_LABEL[option.provider]}
                </Button>
              ))}
            </div>
          ) : null}
          <p className='truncate text-[11px] text-muted-foreground'>
            {PROVIDER_LABEL[selected.provider]} · {selected.project}
          </p>
          <div className='flex items-center gap-2'>
            <Input
              aria-label='Issue, pull request ou merge request'
              placeholder={
                selected.provider === 'GITLAB'
                  ? '#42, !42 ou a URL'
                  : '#42 ou a URL'
              }
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              className='h-8 text-xs'
            />
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={link.isPending || ref.trim() === ''}
              onClick={() =>
                link.mutate(
                  {
                    ticketId: ticket.id,
                    ref: ref.trim(),
                    provider: selected.provider,
                  },
                  {
                    onSuccess: () => {
                      setRef('')
                      notify.success('Item vinculado')
                    },
                    onError: (error) => notify.error(error.message),
                  },
                )
              }
            >
              Vincular
            </Button>
          </div>
          {selected.allowIssueFromTicket ? (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={createIssue.isPending}
              className='self-start'
              onClick={() =>
                createIssue.mutate(
                  { ticketId: ticket.id, provider: selected.provider },
                  {
                    onSuccess: () =>
                      notify.success(
                        `Issue aberta no ${PROVIDER_LABEL[selected.provider]}`,
                      ),
                    onError: (error) => notify.error(error.message),
                  },
                )
              }
            >
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Abrir issue a partir do chamado
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
