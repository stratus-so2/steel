'use client'

import {
  AiBrain01Icon,
  CheckmarkBadge01Icon,
  Wrench01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelAiTopBar } from '@/app/_components/steel-ai/steel-ai-top-bar'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSteelAgent, useSteelAgentRun } from '@/src/hooks/use-steel-agents'
import type { SteelAgentRunStepDTO } from '@/types/steel-agent'
import { SteelAgentApprovalCard } from './steel-agent-approval-card'
import {
  formatAgentDate,
  RUN_STATUS_LABEL,
  RUN_STATUS_VARIANT,
  STEP_STATUS_LABEL,
  TRIGGER_LABEL,
} from './steel-agent-labels'

const STEP_ICON = {
  MODEL: AiBrain01Icon,
  TOOL: Wrench01Icon,
  APPROVAL: CheckmarkBadge01Icon,
} as const

function stepTitle(step: SteelAgentRunStepDTO): string {
  if (step.kind === 'MODEL') return 'Modelo pensou'
  const name = step.toolLabel ?? step.toolName ?? 'Ferramenta'
  return step.kind === 'APPROVAL' ? `Pediu aprovação: ${name}` : name
}

function stepDetail(step: SteelAgentRunStepDTO): string | null {
  const output = (step.output ?? {}) as Record<string, unknown>
  if (step.error) return step.error
  if (step.kind === 'MODEL') {
    const text = typeof output.text === 'string' ? output.text : ''
    const calls = Array.isArray(output.toolCalls) ? output.toolCalls.length : 0
    if (text) return text
    return calls > 0 ? `Chamou ${calls} ferramenta(s)` : null
  }
  if (typeof output.summary === 'string') return output.summary
  if (typeof output.title === 'string') return output.title
  return null
}

/**
 * `/ai/agents/[agentId]/runs/[runId]` — run summary, step timeline and the
 * approval screen (the inbox notification links here).
 */
export function SteelAgentRunView({
  workspaceId,
  slug,
  agentId,
  runId,
}: {
  workspaceId: string
  slug: string
  agentId: string
  runId: string
}) {
  const run = useSteelAgentRun(workspaceId, agentId, runId)
  const agent = useSteelAgent(workspaceId, agentId)
  const timezone = agent.data?.timezone ?? 'America/Sao_Paulo'

  if (run.isLoading) {
    return (
      <div className='space-y-3 p-6' aria-hidden>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-40 rounded-xl' />
      </div>
    )
  }
  if (!run.data) {
    return (
      <div className='p-6 text-muted-foreground text-sm'>
        Execução não encontrada.{' '}
        <Link
          href={`/${slug}/ai/agents/${agentId}`}
          className='text-primary underline'
        >
          Voltar para o agente
        </Link>
      </div>
    )
  }
  const data = run.data
  const pending = data.pendingActions.filter((a) => a.status === 'PENDING')
  const decided = data.pendingActions.filter((a) => a.status !== 'PENDING')

  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <SteelAiTopBar title={`${data.agent.name} · execução`} />
      <div className='mx-auto w-full max-w-3xl flex-1 space-y-6 overflow-y-auto p-4 md:p-6'>
        <header className='space-y-2'>
          <Link
            href={`/${slug}/ai/agents/${agentId}`}
            className='text-muted-foreground text-xs hover:underline'
          >
            ← {data.agent.name}
          </Link>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant={RUN_STATUS_VARIANT[data.status]}>
              {RUN_STATUS_LABEL[data.status]}
            </Badge>
            <span className='text-muted-foreground text-xs'>
              {TRIGGER_LABEL[data.triggerType]} ·{' '}
              {formatAgentDate(data.createdAt, timezone)}
              {data.modelKey ? ` · ${data.modelKey}` : null}
              {` · ${data.inputTokens + data.outputTokens} tokens · US$ ${data.costUsd.toFixed(4)}`}
            </span>
          </div>
          {data.summary ? (
            <p className='whitespace-pre-wrap text-sm leading-relaxed'>
              {data.summary}
            </p>
          ) : null}
          {data.error ? (
            <p className='text-destructive text-sm'>{data.error}</p>
          ) : null}
        </header>

        {pending.length > 0 ? (
          <section className='space-y-2' aria-label='Aguardando aprovação'>
            <h2 className='font-semibold text-sm'>Aguardando aprovação</h2>
            {pending.map((action) => (
              <SteelAgentApprovalCard
                key={action.id}
                workspaceId={workspaceId}
                runId={runId}
                action={action}
                canApprove={data.canApprove}
              />
            ))}
          </section>
        ) : null}

        <section className='space-y-2' aria-label='Linha do tempo'>
          <h2 className='font-semibold text-sm'>Linha do tempo</h2>
          {data.steps.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              {data.status === 'QUEUED'
                ? 'A execução está na fila.'
                : 'Nenhuma etapa registrada.'}
            </p>
          ) : (
            <ol className='relative space-y-3 border-l pl-5'>
              {data.steps.map((step) => {
                const detail = stepDetail(step)
                return (
                  <li key={step.id} className='relative'>
                    <span
                      className={cn(
                        'absolute top-0.5 -left-[29px] flex size-6 items-center justify-center rounded-full border bg-background',
                        step.status === 'FAILED' &&
                          'border-destructive text-destructive',
                      )}
                    >
                      <SteelIcon
                        icon={STEP_ICON[step.kind]}
                        strokeWidth={2}
                        className='size-3.5'
                      />
                    </span>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='font-medium text-sm'>
                        {stepTitle(step)}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {STEP_STATUS_LABEL[step.status]} ·{' '}
                        {formatAgentDate(step.createdAt, timezone)}
                      </span>
                    </div>
                    {detail ? (
                      <p className='mt-0.5 line-clamp-4 whitespace-pre-wrap text-muted-foreground text-xs'>
                        {detail}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {decided.length > 0 ? (
          <section className='space-y-2' aria-label='Ações decididas'>
            <h2 className='font-semibold text-sm'>Ações decididas</h2>
            {decided.map((action) => (
              <SteelAgentApprovalCard
                key={action.id}
                workspaceId={workspaceId}
                runId={runId}
                action={action}
                canApprove={false}
              />
            ))}
          </section>
        ) : null}
      </div>
    </div>
  )
}
