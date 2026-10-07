'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { stashSteelAiPrompt } from '@/app/_components/steel-ai/steel-ai-handoff'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { useCreateSteelAiConversation } from '@/src/hooks/use-steel-ai'
import {
  type AskSteelAiReference,
  buildAskSteelAiPrompt,
  finalizeAskSteelAiPrompt,
} from './ask-steel-ai-prompt'

/** Quick questions that complete the prefilled reference. */
export const ASK_STEEL_AI_SUGGESTIONS: { label: string; question: string }[] = [
  { label: 'Resumir', question: 'faça um resumo do que aconteceu até agora.' },
  {
    label: 'Próximos passos',
    question: 'quais são os próximos passos recomendados?',
  },
  { label: 'Riscos', question: 'quais riscos ou pendências você vê aqui?' },
]

export interface AskSteelAiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  /** Defaults to the `[workspace-slug]` route segment. */
  slug?: string
  reference: AskSteelAiReference
}

/**
 * Mount it only while open (`{open ? <AskSteelAiDialog … /> : null}`): it
 * needs the app router, and screens that never open it should not.
 *
 * Small dialog that starts a new Steel AI conversation (Ask mode) about a
 * record: the prompt comes prefilled with the record reference, the user
 * completes it, and the chat screen sends it on arrival (welcome handoff).
 */
export function AskSteelAiDialog({
  open,
  onOpenChange,
  workspaceId,
  slug,
  reference,
}: AskSteelAiDialogProps) {
  const router = useRouter()
  const params = useParams<{ 'workspace-slug'?: string }>()
  const workspaceSlug = slug ?? params?.['workspace-slug'] ?? ''
  const create = useCreateSteelAiConversation(workspaceId)
  const prefix = buildAskSteelAiPrompt(reference)
  const [text, setText] = useState(prefix)
  const [leaving, setLeaving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Cursor at the end of the prefix, ready to type the question.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const busy = create.isPending || leaving

  async function submit() {
    if (busy) return
    const content = finalizeAskSteelAiPrompt(prefix, text)
    setLeaving(true)
    try {
      const conversation = await create.mutateAsync({ mode: 'EXPLORE' })
      stashSteelAiPrompt(conversation.id, { content, mode: 'EXPLORE' })
      onOpenChange(false)
      router.push(`/${workspaceSlug}/ai/${conversation.id}`)
    } catch (error) {
      setLeaving(false)
      notify.error(error, 'Não foi possível abrir o Steel AI')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Perguntar ao Steel AI</DialogTitle>
          <DialogDescription>
            Abre uma nova conversa no modo Perguntar, já com a referência deste
            registro.
          </DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void submit()
              }
            }}
            aria-label='Pergunta para o Steel AI'
            rows={4}
            disabled={busy}
          />
          <div className='flex flex-wrap gap-1.5'>
            {ASK_STEEL_AI_SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion.label}
                type='button'
                size='xs'
                variant='outline'
                disabled={busy}
                onClick={() => {
                  setText(`${prefix}${suggestion.question}`)
                  inputRef.current?.focus()
                }}
              >
                {suggestion.label}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={busy}>
              {busy ? 'Abrindo…' : 'Perguntar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
