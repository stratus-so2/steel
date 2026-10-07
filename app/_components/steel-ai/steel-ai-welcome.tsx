'use client'

import { AiMagicIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useCreateSteelAiConversation,
  useSteelAiCapabilities,
} from '@/src/hooks/use-steel-ai'
import { isQuotaExceeded } from '@/src/lib/ai/quota'
import type { AiConversationModeDTO } from '@/types/steel-ai'
import { SteelAiComposer } from './steel-ai-composer'
import { useSteelAiWorkspace } from './steel-ai-context'
import { stashSteelAiPrompt } from './steel-ai-handoff'
import { STEEL_AI_QUOTA_MESSAGE, SteelAiNotice } from './steel-ai-notice'
import { STEEL_AI_MODULE_META, steelAiStartersFor } from './steel-ai-starters'
import { SteelAiTopBar } from './steel-ai-top-bar'

/** Starters shown on phones — the rest appear from `sm` up. */
const MOBILE_STARTERS = 4

/**
 * New chat: greeting, centered composer and prompt starters. Submitting
 * creates the conversation, hands the prompt to the chat screen and
 * navigates there — the chat screen docks the composer and streams.
 */
export function SteelAiWelcome() {
  const { workspaceId, slug, firstName } = useSteelAiWorkspace()
  const router = useRouter()
  const capabilities = useSteelAiCapabilities(workspaceId)
  const createConversation = useCreateSteelAiConversation(workspaceId)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<AiConversationModeDTO>('EXPLORE')
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agentModeEnabled = capabilities.data?.agentModeEnabled ?? false
  const effectiveMode = agentModeEnabled ? mode : 'EXPLORE'
  const quota = capabilities.data?.quota
  const quotaExhausted = quota
    ? isQuotaExceeded(quota.usedUsd, quota.quotaUsd)
    : false
  const starters = capabilities.data
    ? steelAiStartersFor(capabilities.data.modules, agentModeEnabled)
    : []

  async function start(content: string, startMode: AiConversationModeDTO) {
    const text = content.trim()
    if (!text || createConversation.isPending || leaving) return
    setError(null)
    setLeaving(true)
    try {
      const conversation = await createConversation.mutateAsync({
        mode: startMode,
      })
      stashSteelAiPrompt(conversation.id, { content: text, mode: startMode })
      router.push(`/${slug}/ai/${conversation.id}`)
    } catch (err) {
      setLeaving(false)
      setError(
        err instanceof Error ? err.message : 'Não foi possível iniciar o chat.',
      )
    }
  }

  return (
    <div className='flex h-full w-full min-w-0 flex-col'>
      <SteelAiTopBar />
      <div className='flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 py-6 sm:px-6 sm:py-8'>
        <div className='my-auto flex w-full max-w-2xl flex-col items-center gap-5 sm:gap-6'>
          <div
            className={cn(
              'flex flex-col items-center gap-3 text-center motion-safe:transition-all motion-safe:duration-300',
              leaving && '-translate-y-2 opacity-0',
            )}
          >
            <span className='hidden size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex'>
              <SteelIcon
                icon={AiMagicIcon}
                strokeWidth={2}
                className='size-6'
              />
            </span>
            <div className='space-y-1'>
              <h1 className='font-semibold text-xl tracking-tight sm:text-2xl'>
                {firstName ? `Olá, ${firstName}` : 'Olá'}
              </h1>
              <p className='text-muted-foreground text-sm'>
                Como o Steel AI pode ajudar hoje?
              </p>
            </div>
          </div>

          {quotaExhausted ? (
            <SteelAiNotice className='w-full'>
              {STEEL_AI_QUOTA_MESSAGE}
            </SteelAiNotice>
          ) : null}
          {error ? (
            <SteelAiNotice className='w-full'>{error}</SteelAiNotice>
          ) : null}

          <SteelAiComposer
            value={draft}
            onChange={setDraft}
            onSubmit={() => start(draft, effectiveMode)}
            mode={effectiveMode}
            onModeChange={setMode}
            agentModeEnabled={agentModeEnabled}
            isSubmitting={leaving}
            disabled={quotaExhausted}
            autoFocus
          />

          <div
            className={cn(
              'w-full motion-safe:transition-opacity motion-safe:duration-300',
              leaving && 'opacity-0',
            )}
          >
            {capabilities.isLoading ? (
              <div
                className='grid grid-cols-1 gap-2 sm:grid-cols-2'
                aria-hidden
              >
                {[0, 1, 2, 3].map((key) => (
                  <Skeleton key={key} className='h-10 rounded-xl sm:h-14' />
                ))}
              </div>
            ) : starters.length > 0 ? (
              <ul className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {starters.map((starter, index) => {
                  const meta = STEEL_AI_MODULE_META[starter.module]
                  return (
                    <li
                      key={starter.prompt}
                      className={cn(
                        'min-w-0',
                        index >= MOBILE_STARTERS && 'hidden sm:block',
                      )}
                    >
                      <button
                        type='button'
                        disabled={quotaExhausted || leaving}
                        onClick={() => start(starter.prompt, starter.mode)}
                        className='flex h-full w-full items-center gap-2.5 rounded-xl border border-border/70 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 sm:items-start sm:py-2.5'
                      >
                        <SteelIcon
                          icon={meta.icon}
                          strokeWidth={2}
                          className='size-4 shrink-0 text-muted-foreground sm:mt-0.5'
                        />
                        <span className='min-w-0 space-y-0.5'>
                          <span className='block truncate font-medium text-sm sm:whitespace-normal'>
                            {starter.label}
                          </span>
                          <span className='hidden text-muted-foreground text-xs sm:block'>
                            {meta.label}
                            {starter.mode === 'AGENT' ? ' · Agente' : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
