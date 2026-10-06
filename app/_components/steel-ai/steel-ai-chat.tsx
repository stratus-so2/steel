'use client'

import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError } from '@/src/hooks/_fetch'
import {
  STEEL_AI_CAPABILITIES_KEY,
  useSteelAiCapabilities,
  useSteelAiConversation,
  useSteelAiMessages,
  useSteelAiStream,
} from '@/src/hooks/use-steel-ai'
import { isQuotaExceeded } from '@/src/lib/ai/quota'
import type { AiConversationModeDTO } from '@/types/steel-ai'
import { SteelAiComposer } from './steel-ai-composer'
import { useSteelAiWorkspace } from './steel-ai-context'
import {
  type SteelAiPendingPrompt,
  takeSteelAiPrompt,
} from './steel-ai-handoff'
import { STEEL_AI_UNTITLED } from './steel-ai-history'
import { STEEL_AI_QUOTA_MESSAGE, SteelAiNotice } from './steel-ai-notice'
import { SteelAiTopBar } from './steel-ai-top-bar'
import {
  SteelAiTranscript,
  SteelAiTranscriptSkeleton,
} from './steel-ai-transcript'

const STICK_THRESHOLD_PX = 80

/**
 * A conversation: transcript + docked composer. When it is opened from the
 * welcome screen it takes the handed-over prompt once, slides the composer
 * from the center to the bottom (skipped with reduced motion) and streams.
 */
export function SteelAiChat({ conversationId }: { conversationId: string }) {
  const { workspaceId, slug } = useSteelAiWorkspace()
  const queryClient = useQueryClient()
  const capabilities = useSteelAiCapabilities(workspaceId)
  const conversation = useSteelAiConversation(workspaceId, conversationId)
  const messages = useSteelAiMessages(workspaceId, conversationId)
  const stream = useSteelAiStream(workspaceId, conversationId)

  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<AiConversationModeDTO | null>(null)
  const [handoff, setHandoff] = useState<SteelAiPendingPrompt | null>(null)
  const [dockOffset, setDockOffset] = useState(0)
  const [showJump, setShowJump] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLFormElement>(null)
  const stickRef = useRef(true)
  const takenRef = useRef(false)
  const sentRef = useRef(false)

  const agentModeEnabled = capabilities.data?.agentModeEnabled ?? false
  const chosenMode = mode ?? conversation.data?.mode ?? 'EXPLORE'
  const effectiveMode =
    chosenMode === 'AGENT' && capabilities.data && !agentModeEnabled
      ? 'EXPLORE'
      : chosenMode
  const quota = capabilities.data?.quota
  const quotaExhausted = quota
    ? isQuotaExceeded(quota.usedUsd, quota.quotaUsd)
    : false

  const scrollToBottom = useCallback((smooth = false) => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTo({
      top: node.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  const submit = useCallback(
    async (content: string, sendMode: AiConversationModeDTO) => {
      const text = content.trim()
      if (!text) return
      stickRef.current = true
      setShowJump(false)
      const result = await stream.send({ content: text, mode: sendMode })
      if (result.error?.code === 'AI_AGENT_MODE_DISABLED') {
        setMode('EXPLORE')
        queryClient.invalidateQueries({
          queryKey: STEEL_AI_CAPABILITIES_KEY(workspaceId),
        })
      }
      // Rejected before streaming: nothing was saved, give the text back.
      if (result.error && result.error.status !== null) {
        setDraft((current) => (current.trim() ? current : text))
      }
    },
    [stream.send, queryClient, workspaceId],
  )

  // Take the prompt handed over by the welcome screen (once, before paint,
  // so the composer can start where it was: in the center).
  useLayoutEffect(() => {
    if (takenRef.current) return
    takenRef.current = true
    const prompt = takeSteelAiPrompt(conversationId)
    if (!prompt) return
    const container = scrollRef.current?.parentElement
    const form = composerRef.current
    if (container && form) {
      const box = container.getBoundingClientRect()
      const rect = form.getBoundingClientRect()
      const centeredTop = box.top + (box.height - rect.height) / 2
      setDockOffset(Math.max(0, rect.top - centeredTop))
    }
    setMode(prompt.mode)
    setHandoff(prompt)
  }, [conversationId])

  useEffect(() => {
    if (dockOffset === 0) return
    const frame = requestAnimationFrame(() => setDockOffset(0))
    return () => cancelAnimationFrame(frame)
  }, [dockOffset])

  useEffect(() => {
    if (!handoff || sentRef.current) return
    sentRef.current = true
    submit(handoff.content, handoff.mode)
  }, [handoff, submit])

  // Follow the reply while the user is at the bottom; never pull them back
  // down after they scrolled up to read.
  const liveContent = stream.live?.content
  const liveTools = stream.live?.toolCalls.length
  const liveActions = stream.live?.pendingActions.length
  useLayoutEffect(() => {
    if (stickRef.current) scrollToBottom()
  }, [
    messages.data,
    stream.pendingUserMessage,
    liveContent,
    liveTools,
    liveActions,
    scrollToBottom,
  ])

  function onScroll() {
    const node = scrollRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    stickRef.current = distance < STICK_THRESHOLD_PX
    setShowJump(!stickRef.current)
  }

  const notFound =
    (messages.error instanceof ApiError && messages.error.status === 404) ||
    (conversation.error instanceof ApiError &&
      conversation.error.status === 404)

  if (notFound) {
    return (
      <div className='flex h-full w-full min-w-0 flex-col'>
        <SteelAiTopBar />
        <div className='flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center'>
          <p className='font-medium'>Conversa não encontrada</p>
          <p className='max-w-sm text-muted-foreground text-sm'>
            Ela pode ter sido excluída ou pertencer a outra pessoa.
          </p>
          <Button
            variant='outline'
            size='sm'
            render={<Link href={`/${slug}/ai`} />}
            nativeButton={false}
          >
            Começar um novo chat
          </Button>
        </div>
      </div>
    )
  }

  const history = messages.data ?? []
  const isEmpty =
    history.length === 0 && stream.pendingUserMessage === null && !stream.live
  const errorMessage = stream.error
    ? stream.error.code === 'AI_QUOTA_EXCEEDED'
      ? stream.error.message || STEEL_AI_QUOTA_MESSAGE
      : stream.error.message
    : null

  return (
    <div className='flex h-full w-full min-w-0 flex-col'>
      <SteelAiTopBar
        title={
          conversation.data ? conversation.data.title || STEEL_AI_UNTITLED : ''
        }
      />
      <div className='relative flex min-h-0 flex-1 flex-col'>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className='min-h-0 flex-1 overflow-y-auto'
        >
          <div className='mx-auto w-full max-w-3xl px-4 pt-6 pb-10'>
            {messages.isLoading && !handoff ? (
              <SteelAiTranscriptSkeleton />
            ) : messages.isError ? (
              <SteelAiNotice>
                Não foi possível carregar as mensagens desta conversa.
              </SteelAiNotice>
            ) : isEmpty && !handoff ? (
              <p className='pt-16 text-center text-muted-foreground text-sm'>
                Envie uma mensagem para começar.
              </p>
            ) : (
              <SteelAiTranscript
                workspaceId={workspaceId}
                messages={history}
                pendingUserMessage={stream.pendingUserMessage}
                live={stream.live}
              />
            )}
          </div>
        </div>

        {showJump ? (
          <Button
            variant='outline'
            size='icon-sm'
            aria-label='Ir para o fim da conversa'
            className='-translate-x-1/2 absolute bottom-36 left-1/2 rounded-full shadow-md'
            onClick={() => {
              stickRef.current = true
              setShowJump(false)
              scrollToBottom(true)
            }}
          >
            <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
          </Button>
        ) : null}

        <div className='shrink-0 px-4 pb-4'>
          <div className='mx-auto w-full max-w-3xl space-y-2'>
            {quotaExhausted && stream.error?.code !== 'AI_QUOTA_EXCEEDED' ? (
              <SteelAiNotice>{STEEL_AI_QUOTA_MESSAGE}</SteelAiNotice>
            ) : null}
            {errorMessage ? (
              <SteelAiNotice
                action={
                  <button
                    type='button'
                    onClick={stream.clearError}
                    className='font-medium underline-offset-2 hover:underline'
                  >
                    Fechar
                  </button>
                }
              >
                {errorMessage}
              </SteelAiNotice>
            ) : null}
            <SteelAiComposer
              containerRef={composerRef}
              value={draft}
              onChange={setDraft}
              onSubmit={() => {
                const text = draft
                setDraft('')
                submit(text, effectiveMode)
              }}
              onStop={stream.stop}
              mode={effectiveMode}
              onModeChange={setMode}
              agentModeEnabled={agentModeEnabled}
              isStreaming={stream.isStreaming}
              disabled={quotaExhausted}
              placeholder='Responda ao Steel AI…'
              autoFocus
              style={
                dockOffset > 0
                  ? { transform: `translateY(-${dockOffset}px)` }
                  : undefined
              }
              className={cn(
                dockOffset === 0 &&
                  'motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
              )}
            />
            <p className='text-center text-[11px] text-muted-foreground'>
              O Steel AI pode errar. Confira as informações importantes
              {effectiveMode === 'AGENT'
                ? ' — nenhuma alteração é feita sem a sua confirmação.'
                : '.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
