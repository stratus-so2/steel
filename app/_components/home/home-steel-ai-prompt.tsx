'use client'

import { AiMagicIcon, ArrowUp02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { useQuickSend } from '@/app/_components/shortcuts/use-quick-send'
import { stashSteelAiPrompt } from '@/app/_components/steel-ai/steel-ai-handoff'
import {
  STEEL_AI_DISABLED_MESSAGE,
  STEEL_AI_QUOTA_MESSAGE,
  SteelAiNotice,
} from '@/app/_components/steel-ai/steel-ai-notice'
import { SteelIcon } from '@/components/icon/icon'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { notify } from '@/lib/notify'
import {
  useCreateSteelAiConversation,
  useSteelAiCapabilities,
} from '@/src/hooks/use-steel-ai'
import { isQuotaExceeded } from '@/src/lib/ai/quota'

/**
 * Home's Steel AI field: the question opens a new conversation and the chat
 * page takes it from there (same handoff as the /ai welcome screen).
 */
export function HomeSteelAiPrompt({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const capabilities = useSteelAiCapabilities(workspaceId)
  const createConversation = useCreateSteelAiConversation(workspaceId)
  const [draft, setDraft] = useState('')
  const quickSend = useQuickSend()
  const [leaving, setLeaving] = useState(false)

  const caps = capabilities.data
  const aiDisabled = caps?.aiEnabled === false
  const quotaExhausted = caps?.quota
    ? isQuotaExceeded(caps.quota.usedUsd, caps.quota.quotaUsd)
    : false
  const blocked = aiDisabled || quotaExhausted
  const busy = createConversation.isPending || leaving

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || busy || blocked) return
    setLeaving(true)
    try {
      const conversation = await createConversation.mutateAsync({
        mode: 'EXPLORE',
      })
      stashSteelAiPrompt(conversation.id, { content: text, mode: 'EXPLORE' })
      router.push(`/${slug}/ai/${conversation.id}`)
    } catch (error) {
      setLeaving(false)
      notify.error(error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-2'>
      <InputGroup className='bg-background'>
        <InputGroupTextarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          data-composer
          onKeyDown={(event) => {
            if (quickSend.isSend(event)) {
              event.preventDefault()
              handleSubmit()
            }
          }}
          disabled={blocked || busy}
          rows={2}
          placeholder='Pergunte ao Steel AI…'
          aria-label='Pergunte ao Steel AI'
          className='max-h-40 min-h-16'
        />
        <InputGroupAddon align='block-end' className='justify-between'>
          <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <SteelIcon icon={AiMagicIcon} strokeWidth={2} />
            Steel AI
          </span>
          <InputGroupButton
            type='submit'
            variant='default'
            size='icon-xs'
            className='rounded-full'
            aria-label='Enviar para o Steel AI'
            disabled={!draft.trim() || blocked || busy}
          >
            <SteelIcon icon={ArrowUp02Icon} strokeWidth={2} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {aiDisabled && <SteelAiNotice>{STEEL_AI_DISABLED_MESSAGE}</SteelAiNotice>}
      {!aiDisabled && quotaExhausted && (
        <SteelAiNotice>{STEEL_AI_QUOTA_MESSAGE}</SteelAiNotice>
      )}
    </form>
  )
}
