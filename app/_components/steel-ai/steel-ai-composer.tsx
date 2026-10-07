'use client'

import {
  ArrowUp02Icon,
  Loading03Icon,
  StopIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { CSSProperties, Ref } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AiConversationModeDTO } from '@/types/steel-ai'
import { SteelAiModeSwitch } from './steel-ai-mode-switch'

export const STEEL_AI_MAX_MESSAGE = 8000

/**
 * Prompt box shared by the welcome and the chat screens: a single-border
 * card with an auto-growing textarea, Explorar | Agente switch and send/stop. Enter sends,
 * Shift+Enter breaks the line.
 */
export function SteelAiComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  mode,
  onModeChange,
  agentModeEnabled,
  isStreaming = false,
  isSubmitting = false,
  disabled = false,
  placeholder = 'Pergunte qualquer coisa ao Steel AI…',
  autoFocus,
  containerRef,
  className,
  style,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop?: () => void
  mode: AiConversationModeDTO
  onModeChange: (mode: AiConversationModeDTO) => void
  agentModeEnabled: boolean
  isStreaming?: boolean
  isSubmitting?: boolean
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  containerRef?: Ref<HTMLFormElement>
  className?: string
  style?: CSSProperties
}) {
  const canSend =
    !disabled &&
    !isStreaming &&
    !isSubmitting &&
    value.trim().length > 0 &&
    value.length <= STEEL_AI_MAX_MESSAGE

  return (
    <form
      ref={containerRef}
      style={style}
      className={cn('w-full', className)}
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSubmit()
      }}
    >
      <div
        className={cn(
          'flex flex-col rounded-2xl border border-border bg-background shadow-xs transition-[border-color,box-shadow] focus-within:border-ring/60 focus-within:shadow-sm motion-reduce:transition-none dark:bg-input/30',
          disabled && 'opacity-60',
        )}
      >
        <textarea
          aria-label='Mensagem para o Steel AI'
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={STEEL_AI_MAX_MESSAGE}
          rows={1}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              if (canSend) onSubmit()
            }
          }}
          className='field-sizing-content block max-h-60 min-h-12 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-base leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed sm:text-sm'
        />
        <div className='flex items-center gap-2 px-2.5 pt-1 pb-2.5'>
          <SteelAiModeSwitch
            value={mode}
            onChange={onModeChange}
            agentModeEnabled={agentModeEnabled}
            disabled={isStreaming || isSubmitting}
          />
          <span className='ml-auto' />
          {isStreaming && onStop ? (
            <Button
              type='button'
              size='icon-sm'
              aria-label='Parar resposta'
              className='shrink-0 rounded-full'
              onClick={onStop}
            >
              <SteelIcon icon={StopIcon} strokeWidth={2} />
            </Button>
          ) : (
            <Button
              type='submit'
              size='icon-sm'
              aria-label='Enviar mensagem'
              className='shrink-0 rounded-full'
              disabled={!canSend}
            >
              <SteelIcon
                icon={isSubmitting ? Loading03Icon : ArrowUp02Icon}
                strokeWidth={2}
                className={cn(isSubmitting && 'motion-safe:animate-spin')}
              />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
