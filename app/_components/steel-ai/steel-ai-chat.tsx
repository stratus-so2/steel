'use client'

import {
  Airplane01Icon,
  ArrowDown01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
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
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { ApiError } from '@/src/hooks/_fetch'
import {
  STEEL_AI_CAPABILITIES_KEY,
  useSteelAiCapabilities,
  useSteelAiConversation,
  useSteelAiMessages,
  useSteelAiStream,
  useUpdateSteelAiConversation,
} from '@/src/hooks/use-steel-ai'
import { isQuotaExceeded } from '@/src/lib/ai/quota'
import type { AiAttachmentDTO, AiConversationModeDTO } from '@/types/steel-ai'
import {
  STEEL_AI_DEFAULT_ATTACHMENT_LIMITS,
  useSteelAiDraftAttachments,
} from './steel-ai-attachments'
import { SteelAiComposer } from './steel-ai-composer'
import { useSteelAiWorkspace } from './steel-ai-context'
import {
  type SteelAiPendingPrompt,
  takeSteelAiPrompt,
} from './steel-ai-handoff'
import { STEEL_AI_UNTITLED } from './steel-ai-history'
import { allowedSteelAiMode } from './steel-ai-mode-switch'
import {
  STEEL_AI_AUTOPILOT_NOTICE,
  STEEL_AI_DISABLED_MESSAGE,
  STEEL_AI_QUOTA_MESSAGE,
  SteelAiNotice,
} from './steel-ai-notice'
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
  const updateConversation = useUpdateSteelAiConversation(workspaceId)
  const caps = capabilities.data
  const files = useSteelAiDraftAttachments({
    workspaceId,
    conversationId,
    limits: caps?.attachments ?? STEEL_AI_DEFAULT_ATTACHMENT_LIMITS,
    onReject: (message) => notify.error(message),
  })

  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<AiConversationModeDTO | null>(null)
  const [modelKey, setModelKey] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<SteelAiPendingPrompt | null>(null)
  const [dockOffset, setDockOffset] = useState(0)
  const [showJump, setShowJump] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLFormElement>(null)
  const stickRef = useRef(true)
  const takenRef = useRef(false)
  const sentRef = useRef(false)

  const agentModeEnabled = caps?.agentModeEnabled ?? false
  const autopilotEnabled = caps?.autopilotEnabled ?? false
  const aiDisabled = caps?.aiEnabled === false
  const chosenMode = mode ?? conversation.data?.mode ?? 'EXPLORE'
  const effectiveMode = allowedSteelAiMode(chosenMode, caps ?? null)
  const selectedModel =
    modelKey ?? conversation.data?.modelKey ?? caps?.modelKey ?? null
  const quota = caps?.quota
  const quotaExhausted = quota
    ? isQuotaExceeded(quota.usedUsd, quota.quotaUsd)
    : false

  const scrollToBottom = useCallback((smooth = false) => {
    const node = scrollRef.current
    if (!node) return
    if (smooth && typeof node.scrollTo === 'function') {
      node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    } else {
      node.scrollTop = node.scrollHeight
    }
  }, [])

  const submit = useCallback(
    async (
      content: string,
      sendMode: AiConversationModeDTO,
      options: {
        attachments?: AiAttachmentDTO[]
        modelKey?: string | null
      } = {},
    ) => {
      const text = content.trim()
      const attachments = options.attachments ?? []
      if (!text && attachments.length === 0) return
      stickRef.current = true
      setShowJump(false)
      const result = await stream.send(
        {
          content: text,
          mode: sendMode,
          ...(options.modelKey && { modelKey: options.modelKey }),
          attachmentIds: attachments.map((a) => a.id),
        },
        { attachments },
      )
      const code = result.error?.code
      if (
        code === 'AI_AGENT_MODE_DISABLED' ||
        code === 'AI_AUTOPILOT_DISABLED' ||
        code === 'AI_DISABLED'
      ) {
        if (code === 'AI_AGENT_MODE_DISABLED') setMode('EXPLORE')
        if (code === 'AI_AUTOPILOT_DISABLED') setMode('AGENT')
        queryClient.invalidateQueries({
          queryKey: STEEL_AI_CAPABILITIES_KEY(workspaceId),
        })
      }
      // Rejected before streaming: nothing was saved, give the text back.
      if (result.error && result.error.status !== null) {
        setDraft((current) => (current.trim() ? current : text))
        return false
      }
      return true
    },
    [stream.send, queryClient, workspaceId],
  )

  const changeModel = useCallback(
    (key: string) => {
      setModelKey(key)
      updateConversation.mutate(
        { conversationId, data: { modelKey: key } },
        { onError: notify.error },
      )
    },
    [conversationId, updateConversation.mutate],
  )

  async function sendDraft() {
    const text = draft
    const attachments = files.ready
    setDraft('')
    const accepted = await submit(text, effectiveMode, {
      attachments,
      modelKey: selectedModel,
    })
    // The files now belong to the sent message (or the turn failed midway,
    // which also persisted it); a rejected send keeps them for a retry.
    if (accepted) files.clear()
  }

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
    if (prompt.modelKey) setModelKey(prompt.modelKey)
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
    submit(handoff.content, handoff.mode, {
      attachments: handoff.attachments,
      modelKey: handoff.modelKey,
    })
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
          <div className='mx-auto w-full max-w-3xl px-4 pt-4 pb-8 sm:px-6 sm:pt-6 sm:pb-10'>
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
                pendingAttachments={stream.pendingAttachments}
                live={stream.live}
              />
            )}
          </div>
        </div>

        <div className='relative shrink-0 px-3 pb-2 sm:px-0 sm:pb-3'>
          {showJump ? (
            <Button
              variant='outline'
              size='icon-sm'
              aria-label='Ir para o fim da conversa'
              className='-translate-x-1/2 absolute bottom-full left-1/2 z-10 mb-3 rounded-full bg-background shadow-sm'
              onClick={() => {
                stickRef.current = true
                setShowJump(false)
                scrollToBottom(true)
              }}
            >
              <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
            </Button>
          ) : null}
          <div className='mx-auto w-full max-w-3xl space-y-2 sm:px-6'>
            {aiDisabled ? (
              <SteelAiNotice>{STEEL_AI_DISABLED_MESSAGE}</SteelAiNotice>
            ) : quotaExhausted && stream.error?.code !== 'AI_QUOTA_EXCEEDED' ? (
              <SteelAiNotice>{STEEL_AI_QUOTA_MESSAGE}</SteelAiNotice>
            ) : null}
            {effectiveMode === 'AUTOPILOT' && !aiDisabled ? (
              <SteelAiNotice tone='info' icon={Airplane01Icon}>
                {STEEL_AI_AUTOPILOT_NOTICE}
              </SteelAiNotice>
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
              onSubmit={sendDraft}
              onStop={stream.stop}
              mode={effectiveMode}
              onModeChange={setMode}
              agentModeEnabled={agentModeEnabled}
              autopilotEnabled={autopilotEnabled}
              attachments={{
                items: files.items,
                onAdd: files.add,
                onRemove: files.discard,
                accept: (
                  caps?.attachments ?? STEEL_AI_DEFAULT_ATTACHMENT_LIMITS
                ).accept,
              }}
              model={
                caps
                  ? {
                      models: caps.models,
                      value: selectedModel,
                      onChange: changeModel,
                    }
                  : undefined
              }
              isStreaming={stream.isStreaming}
              disabled={quotaExhausted || aiDisabled}
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
            <p className='px-2 text-center text-[11px] text-muted-foreground leading-snug'>
              O Steel AI pode errar. Confira as informações importantes
              {effectiveMode === 'AGENT'
                ? ' — nenhuma alteração é feita sem a sua confirmação.'
                : effectiveMode === 'AUTOPILOT'
                  ? ' — no Autopilot as alterações são feitas sem confirmação.'
                  : '.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
