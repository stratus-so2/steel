'use client'

import { DashboardSquare02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { SteelAiTopBar } from '@/app/_components/steel-ai/steel-ai-top-bar'
import { agentInputFromTemplate } from '@/app/_components/steel-ai-templates/template-prefill'
import { SteelIcon } from '@/components/icon/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiTemplates } from '@/src/hooks/use-ai-templates'
import { SteelAgentEditor } from './steel-agent-editor'

/** Query flag on the agent page right after creating it from a template. */
export const FROM_TEMPLATE_PARAM = 'from'
export const FROM_TEMPLATE_VALUE = 'template'

/**
 * `/ai/agents/new` — create an agent, then open it. With
 * `?template=<id>` the editor starts pre-filled from that template
 * (nothing is saved until "Criar agente").
 */
export function SteelAgentNew({
  workspaceId,
  slug,
  currentUserId,
  templateId = null,
}: {
  workspaceId: string
  slug: string
  currentUserId: string
  templateId?: string | null
}) {
  const router = useRouter()
  const templates = useAiTemplates(workspaceId)
  const template = templateId
    ? templates.data?.agents.find((t) => t.id === templateId && t.available)
    : undefined
  const waiting = Boolean(templateId) && templates.isLoading

  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <SteelAiTopBar title='Novo agente' />
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <div className='mx-auto w-full max-w-3xl space-y-5 px-4 pt-2 pb-8 sm:px-6 sm:pt-4'>
          <header className='space-y-1'>
            <h1 className='font-semibold text-lg'>Novo agente</h1>
            <p className='text-muted-foreground text-sm'>
              Defina o que o agente faz, quando roda e quais ferramentas pode
              usar.
            </p>
          </header>
          {template ? (
            <div
              role='note'
              className='flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm'
            >
              <SteelIcon
                icon={DashboardSquare02Icon}
                strokeWidth={2}
                className='mt-0.5 size-4 shrink-0 text-muted-foreground'
              />
              <p className='min-w-0'>
                <span className='font-medium'>Modelo: {template.name}.</span>{' '}
                <span className='text-muted-foreground'>
                  Revise e ajuste antes de criar. O agente começa pausado:
                  depois de criar, use “Testar agente” para ver o que ele faria
                  e só então ative.
                </span>
              </p>
            </div>
          ) : templateId && !waiting ? (
            <p className='rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm'>
              Modelo indisponível neste workspace. Comece do zero.
            </p>
          ) : null}
          {waiting ? (
            <div className='space-y-3' aria-hidden>
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className='h-16 rounded-lg' />
              ))}
            </div>
          ) : (
            <SteelAgentEditor
              key={template?.id ?? 'blank'}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              initial={
                template
                  ? agentInputFromTemplate(template, currentUserId)
                  : undefined
              }
              onSaved={(agent) =>
                router.push(
                  template
                    ? `/${slug}/ai/agents/${agent.id}?${FROM_TEMPLATE_PARAM}=${FROM_TEMPLATE_VALUE}`
                    : `/${slug}/ai/agents/${agent.id}`,
                )
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
