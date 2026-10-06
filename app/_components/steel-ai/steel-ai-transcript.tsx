'use client'

import { AiMagicIcon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SteelAiLiveMessage } from '@/src/lib/steel-ai-stream'
import type {
  AiMessageDTO,
  AiPendingActionDTO,
  AiToolCallDTO,
} from '@/types/steel-ai'
import { SteelAiMarkdown } from './steel-ai-markdown'
import { SteelAiPendingActionCard } from './steel-ai-pending-action-card'
import { SteelAiToolCall } from './steel-ai-tool-call'

function UserBubble({
  content,
  animate,
}: {
  content: string
  animate?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-end',
        animate &&
          'motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in motion-safe:duration-300',
      )}
    >
      <div className='max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-sm leading-relaxed'>
        {content}
      </div>
    </div>
  )
}

function AssistantBlock({
  workspaceId,
  content,
  toolCalls,
  pendingActions,
  streaming,
  footer,
}: {
  workspaceId: string
  content: string
  toolCalls: AiToolCallDTO[]
  pendingActions: AiPendingActionDTO[]
  streaming?: boolean
  footer?: string | null
}) {
  const thinking = streaming && !content && toolCalls.length === 0
  return (
    <div className='flex gap-3'>
      <span className='mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
        <SteelIcon
          icon={AiMagicIcon}
          strokeWidth={2}
          className={cn('size-4', streaming && 'motion-safe:animate-pulse')}
        />
      </span>
      <div className='min-w-0 flex-1 space-y-3'>
        {toolCalls.length > 0 ? (
          <ul className='flex flex-col gap-1.5' aria-label='Ferramentas usadas'>
            {toolCalls.map((call) => (
              <SteelAiToolCall key={call.id} call={call} />
            ))}
          </ul>
        ) : null}
        {thinking ? (
          <p
            className='pt-1 text-muted-foreground text-sm motion-safe:animate-pulse'
            aria-live='polite'
          >
            Pensando…
          </p>
        ) : null}
        {content ? (
          <div className='relative'>
            <SteelAiMarkdown content={content} />
            {streaming ? (
              <span
                aria-hidden
                className='ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-sm bg-foreground/60 motion-safe:animate-pulse'
              />
            ) : null}
          </div>
        ) : null}
        {pendingActions.map((action) => (
          <SteelAiPendingActionCard
            key={action.id}
            workspaceId={workspaceId}
            action={action}
          />
        ))}
        {footer ? (
          <p className='text-muted-foreground text-xs italic'>{footer}</p>
        ) : null}
      </div>
    </div>
  )
}

export function SteelAiTranscriptSkeleton() {
  return (
    <div className='space-y-8' role='status' aria-label='Carregando conversa'>
      <div className='flex justify-end'>
        <Skeleton className='h-10 w-2/5 rounded-2xl' />
      </div>
      <div className='flex gap-3'>
        <Skeleton className='size-7 shrink-0 rounded-full' />
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-4 w-11/12' />
          <Skeleton className='h-4 w-9/12' />
          <Skeleton className='h-4 w-10/12' />
        </div>
      </div>
    </div>
  )
}

/** Persisted messages followed by the turn being streamed, if any. */
export function SteelAiTranscript({
  workspaceId,
  messages,
  pendingUserMessage,
  live,
}: {
  workspaceId: string
  messages: AiMessageDTO[]
  pendingUserMessage: string | null
  live: SteelAiLiveMessage | null
}) {
  return (
    <div className='space-y-8'>
      {messages.map((message) =>
        message.role === 'USER' ? (
          <UserBubble key={message.id} content={message.content} />
        ) : (
          <AssistantBlock
            key={message.id}
            workspaceId={workspaceId}
            content={message.content}
            toolCalls={message.toolCalls}
            pendingActions={message.pendingActions}
          />
        ),
      )}
      {pendingUserMessage !== null ? (
        <UserBubble content={pendingUserMessage} animate />
      ) : null}
      {live ? (
        <AssistantBlock
          workspaceId={workspaceId}
          content={live.content}
          toolCalls={live.toolCalls}
          pendingActions={live.pendingActions}
          streaming={live.status === 'streaming'}
          footer={live.status === 'stopped' ? 'Resposta interrompida.' : null}
        />
      ) : null}
    </div>
  )
}
