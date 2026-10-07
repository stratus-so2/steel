'use client'

import { AiBrain01Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelAiTopBar } from '@/app/_components/steel-ai/steel-ai-top-bar'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useSteelAgentCatalog,
  useSteelAgents,
} from '@/src/hooks/use-steel-agents'
import {
  describeTrigger,
  formatAgentDate,
  RUN_STATUS_LABEL,
  RUN_STATUS_VARIANT,
} from './steel-agent-labels'

/** `/ai/agents` — the workspace agents with status and last run. */
export function SteelAgentsList({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const agents = useSteelAgents(workspaceId)
  const catalog = useSteelAgentCatalog(workspaceId)
  const canManage = catalog.data?.canManage ?? false
  const list = agents.data ?? []

  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <SteelAiTopBar
        title='Agentes'
        actions={
          canManage ? (
            <Button
              size='sm'
              aria-label='Novo agente'
              className='max-sm:size-8 max-sm:px-0'
              render={<Link href={`/${slug}/ai/agents/new`} />}
              nativeButton={false}
            >
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              <span className='hidden sm:inline'>Novo agente</span>
            </Button>
          ) : null
        }
      />
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <div className='mx-auto w-full max-w-3xl space-y-5 px-4 pt-2 pb-8 sm:px-6 sm:pt-4'>
          <header className='space-y-1'>
            <h1 className='font-semibold text-lg'>Steel Agents</h1>
            <p className='max-w-prose text-muted-foreground text-sm'>
              Agentes que trabalham sozinhos — por agenda, por evento ou pelo
              botão — com as permissões do responsável. Escritas que pedem
              aprovação chegam na caixa de entrada.
            </p>
          </header>

          {agents.isLoading ? (
            <div className='space-y-2' aria-hidden>
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className='h-16 rounded-xl' />
              ))}
            </div>
          ) : agents.isError ? (
            <p className='text-destructive text-sm'>
              Não foi possível carregar os agentes.
            </p>
          ) : list.length === 0 ? (
            <div className='flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center'>
              <SteelIcon
                icon={AiBrain01Icon}
                strokeWidth={1.5}
                className='size-8 text-muted-foreground'
              />
              <p className='font-medium text-sm'>Nenhum agente ainda</p>
              <p className='max-w-sm text-muted-foreground text-sm'>
                {canManage
                  ? 'Crie um agente para triar chamados, acompanhar leads ou resumir o dia automaticamente.'
                  : 'Peça a um administrador para criar o primeiro agente.'}
              </p>
            </div>
          ) : (
            <ul className='divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card'>
              {list.map((agent) => (
                <li key={agent.id}>
                  <Link
                    href={`/${slug}/ai/agents/${agent.id}`}
                    className='flex flex-col gap-1.5 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 sm:flex-row sm:items-center sm:gap-4'
                  >
                    <div className='min-w-0 flex-1 space-y-0.5'>
                      <div className='flex min-w-0 items-center gap-2'>
                        <span className='truncate font-medium text-sm'>
                          {agent.name}
                        </span>
                        <Badge
                          variant={agent.enabled ? 'secondary' : 'outline'}
                          className='shrink-0'
                        >
                          {agent.enabled ? 'Ativo' : 'Pausado'}
                        </Badge>
                      </div>
                      <p className='truncate text-muted-foreground text-xs'>
                        {describeTrigger(agent, catalog.data?.events)}
                        {agent.owner
                          ? ` · ${agent.owner.name}`
                          : ' · Sem responsável'}
                      </p>
                    </div>
                    <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:shrink-0 sm:flex-nowrap'>
                      {agent.lastRun ? (
                        <>
                          <Badge
                            variant={RUN_STATUS_VARIANT[agent.lastRun.status]}
                          >
                            {RUN_STATUS_LABEL[agent.lastRun.status]}
                          </Badge>
                          <span className='whitespace-nowrap text-muted-foreground'>
                            {formatAgentDate(
                              agent.lastRun.createdAt,
                              agent.timezone,
                            )}
                          </span>
                        </>
                      ) : (
                        <span className='text-muted-foreground'>
                          Nunca executado
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
