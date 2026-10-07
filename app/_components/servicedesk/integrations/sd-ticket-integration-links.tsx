'use client'

import {
  Delete02Icon,
  GithubIcon,
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
} from '@/src/hooks/use-sd-integrations'
import type {
  SdIntegrationLinkDTO,
  SdIntegrationLinkKindDTO,
} from '@/types/sd-integration'
import type { SdTicketDTO } from '@/types/sd-ticket'

/**
 * Bloco "Integrações" da tela do chamado: a thread do Slack que abriu o
 * chamado e as issues/PRs vinculadas, com o estado espelhado do GitHub.
 *
 * Só agentes (a rota é `agentOnly`), então para o solicitante o bloco
 * simplesmente não renderiza. Vincular e abrir issue aparecem em chamados de
 * **problema e mudança** — é onde o trabalho técnico mora.
 */

const KIND_ICON: Record<SdIntegrationLinkKindDTO, typeof SlackIcon> = {
  SLACK_THREAD: SlackIcon,
  GITHUB_ISSUE: GithubIcon,
  GITHUB_PULL_REQUEST: GitPullRequestIcon,
}

const KIND_LABEL: Record<SdIntegrationLinkKindDTO, string> = {
  SLACK_THREAD: 'Thread do Slack',
  GITHUB_ISSUE: 'Issue',
  GITHUB_PULL_REQUEST: 'Pull request',
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
  canEdit,
  onUnlink,
  pending,
}: {
  link: SdIntegrationLinkDTO
  canEdit: boolean
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
        {canEdit ? (
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
        ) : null}
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
  /** Ajuste de moldura (a tela do chamado usa sem borda). */
  className?: string
}) {
  const enabled = mode === 'agent'
  const { data } = useSdIntegrationLinks(workspaceId, ticket.id, { enabled })
  const { link, createIssue, unlink } = useSdIntegrationLinkMutations(
    workspaceId,
    ticket.id,
  )
  const [ref, setRef] = useState('')

  if (!enabled) return null

  const links = data ?? []
  const technical = ticket.type === 'PROBLEM' || ticket.type === 'CHANGE'
  if (links.length === 0 && !technical) return null

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
          Nenhuma issue ou pull request vinculada.
        </p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {links.map((item) => (
            <LinkRow
              key={item.id}
              link={item}
              canEdit
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

      {technical ? (
        <div className='flex flex-col gap-2 border-border border-t pt-2'>
          <div className='flex items-center gap-2'>
            <Input
              aria-label='Issue ou pull request'
              placeholder='#42 ou a URL'
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
                  { ticketId: ticket.id, ref: ref.trim() },
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
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={createIssue.isPending}
            className='self-start'
            onClick={() =>
              createIssue.mutate(
                { ticketId: ticket.id },
                {
                  onSuccess: () => notify.success('Issue aberta no GitHub'),
                  onError: (error) => notify.error(error.message),
                },
              )
            }
          >
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Abrir issue a partir do chamado
          </Button>
        </div>
      ) : null}
    </section>
  )
}
