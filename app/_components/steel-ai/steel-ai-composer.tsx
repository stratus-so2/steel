'use client'

import {
  ArrowUp02Icon,
  Loading03Icon,
  StopIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { CSSProperties, Ref } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'
import type { AiConversationModeDTO } from '@/types/steel-ai'
import { SteelAiModeSwitch } from './steel-ai-mode-switch'

export const STEEL_AI_MAX_MESSAGE = 8000

/**
 * Prompt box shared by the welcome and the chat screens: auto-growing
 * textarea, Explorar | Agente switch and send/stop. Enter sends,
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
      <InputGroup className='rounded-xl bg-background shadow-sm dark:bg-input/30'>
        <InputGroupTextarea
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
          className='max-h-60 min-h-14 px-3.5 pt-3 text-sm'
        />
        <InputGroupAddon align='block-end' className='gap-2'>
          <SteelAiModeSwitch
            value={mode}
            onChange={onModeChange}
            agentModeEnabled={agentModeEnabled}
            disabled={isStreaming || isSubmitting}
          />
          <span className='ml-auto' />
          {isStreaming && onStop ? (
            <InputGroupButton
              type='button'
              size='icon-sm'
              variant='default'
              aria-label='Parar resposta'
              className='rounded-full'
              onClick={onStop}
            >
              <SteelIcon icon={StopIcon} strokeWidth={2} />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type='submit'
              size='icon-sm'
              variant='default'
              aria-label='Enviar mensagem'
              className='rounded-full'
              disabled={!canSend}
            >
              <SteelIcon
                icon={isSubmitting ? Loading03Icon : ArrowUp02Icon}
                strokeWidth={2}
                className={cn(isSubmitting && 'animate-spin')}
              />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
