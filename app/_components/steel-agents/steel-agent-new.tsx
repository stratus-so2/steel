'use client'

import { useRouter } from 'next/navigation'
import { SteelAiTopBar } from '@/app/_components/steel-ai/steel-ai-top-bar'
import { SteelAgentEditor } from './steel-agent-editor'

/** `/ai/agents/new` — create an agent, then open it. */
export function SteelAgentNew({
  workspaceId,
  slug,
  currentUserId,
}: {
  workspaceId: string
  slug: string
  currentUserId: string
}) {
  const router = useRouter()
  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <SteelAiTopBar title='Novo agente' />
      <div className='mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto p-4 md:p-6'>
        <header className='space-y-1'>
          <h1 className='font-semibold text-lg'>Novo agente</h1>
          <p className='text-muted-foreground text-sm'>
            Defina o que o agente faz, quando roda e quais ferramentas pode
            usar.
          </p>
        </header>
        <SteelAgentEditor
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          onSaved={(agent) => router.push(`/${slug}/ai/agents/${agent.id}`)}
        />
      </div>
    </div>
  )
}
