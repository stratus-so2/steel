'use client'

import {
  AiChat02Icon,
  Attachment01Icon,
  Cancel01Icon,
  Delete02Icon,
  File01Icon,
  Image01Icon,
  Loading03Icon,
  MessageMultiple01Icon,
  PlusSignIcon,
  Sent02Icon,
  SparklesIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useCreateCrmAiConversation,
  useCrmAiConversations,
  useCrmAiMessages,
  useDeleteCrmAiConversation,
  useSendCrmAiMessage,
  useUploadCrmAiAttachment,
} from '@/src/hooks/use-crm-ai'
import type { CrmAiAttachmentDTO, CrmAiMessageDTO } from '@/types/crm-ai'

const SUGGESTIONS = [
  'Qual o valor total do meu pipeline por estágio?',
  'Como estão minhas propostas? Quais têm mais visualizações?',
  'Resuma o desempenho das campanhas de e-mail recentes.',
  'Quais tarefas estão atrasadas e quem é o responsável?',
]

/**
 * Balão flutuante do assistente de IA, disponível em todo o workspace
 * (montado no layout privado) — substitui a antiga página dedicada de chat
 * do CRM. Adaptação do original: usa o backend não-streaming já existente
 * do Steel (`crm-ai.service.ts`, OpenAI direto), então mostra um indicador de
 * "digitando" em vez do cursor de streaming token-a-token do original —
 * a UI/UX (histórico, anexos, markdown, sugestões) replica o original.
 */
export function CrmAiAssistantWidget({
  workspaceId,
  userName,
}: {
  workspaceId: string
  userName: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {!open && <Launcher onClick={() => setOpen(true)} />}
      {open && (
        <ChatPanel
          workspaceId={workspaceId}
          userName={userName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function Launcher({ onClick }: { onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label='Abrir assistente de IA'
      className='fixed right-4 bottom-4 z-50 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/10 transition-all hover:brightness-110 active:translate-y-px [&_svg]:size-6'
    >
      <SteelIcon icon={AiChat02Icon} strokeWidth={2} />
    </button>
  )
}

function ChatPanel({
  workspaceId,
  userName,
  onClose,
}: {
  workspaceId: string
  userName: string
  onClose: () => void
}) {
  const [showHistory, setShowHistory] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<
    CrmAiAttachmentDTO[]
  >([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: conversations, refetch: refetchConversations } =
    useCrmAiConversations(workspaceId)
  const createConversation = useCreateCrmAiConversation(workspaceId)
  const deleteConversation = useDeleteCrmAiConversation(workspaceId)
  const { data: messages, isLoading: isLoadingMessages } = useCrmAiMessages(
    workspaceId,
    activeId,
  )
  const sendMessage = useSendCrmAiMessage(workspaceId, activeId)
  const uploadAttachment = useUploadCrmAiAttachment(workspaceId, activeId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, sendMessage.isPending])

  function toggleHistory() {
    const next = !showHistory
    setShowHistory(next)
    if (next) refetchConversations()
  }

  async function startNew() {
    try {
      const conversation = await createConversation.mutateAsync()
      setActiveId(conversation.id)
      setShowHistory(false)
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    try {
      await deleteConversation.mutateAsync(conversationId)
      if (activeId === conversationId) setActiveId(null)
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activeId) return
    try {
      const attachment = await uploadAttachment.mutateAsync(file)
      setPendingAttachments((current) => [...current, attachment])
    } catch (err) {
      notify.error(err)
    }
  }

  async function submit(text?: string) {
    const content = (text ?? draft).trim()
    if (!content || sendMessage.isPending) return

    let conversationId = activeId
    if (!conversationId) {
      try {
        const conversation = await createConversation.mutateAsync()
        conversationId = conversation.id
        setActiveId(conversationId)
      } catch (err) {
        notify.error(err)
        return
      }
    }

    setDraft('')
    const attachmentIds = pendingAttachments.map((a) => a.id)
    setPendingAttachments([])
    try {
      await sendMessage.mutateAsync({ content, attachmentIds })
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='fixed right-4 bottom-4 z-50 flex h-[620px] max-h-[calc(100svh-2rem)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl'>
      <header className='flex shrink-0 items-center gap-2 border-b border-border bg-card/80 px-3 py-2.5 backdrop-blur'>
        <span className='flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary [&_svg]:size-4'>
          <SteelIcon icon={SparklesIcon} strokeWidth={2} />
        </span>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-semibold text-sm leading-tight'>
            Assistente
          </p>
          <p className='truncate text-muted-foreground text-xs leading-tight'>
            Analisa dados do workspace em tempo real
          </p>
        </div>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Histórico de conversas'
          aria-pressed={showHistory}
          onClick={toggleHistory}
        >
          <SteelIcon icon={MessageMultiple01Icon} strokeWidth={2} />
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Nova conversa'
          onClick={startNew}
        >
          <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Fechar'
          onClick={onClose}
        >
          <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </header>

      {showHistory ? (
        <div className='min-h-0 flex-1 overflow-y-auto px-2 py-2'>
          {!conversations || conversations.length === 0 ? (
            <p className='px-2 py-6 text-center text-muted-foreground text-xs'>
              Nenhuma conversa ainda.
            </p>
          ) : (
            <ul className='space-y-0.5'>
              {conversations.map((c) => (
                <li key={c.id} className='group flex items-center gap-1'>
                  <button
                    type='button'
                    onClick={() => {
                      setActiveId(c.id)
                      setShowHistory(false)
                    }}
                    className={cn(
                      'flex-1 truncate rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted',
                      activeId === c.id && 'bg-muted',
                    )}
                  >
                    {c.title || 'Conversa'}
                  </button>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Excluir conversa'
                    className='opacity-0 group-hover:opacity-100'
                    onClick={() => handleDeleteConversation(c.id)}
                  >
                    <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className='min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4'
        >
          {activeId && isLoadingMessages ? (
            <p className='text-center text-muted-foreground text-sm'>
              Carregando…
            </p>
          ) : !activeId || !messages || messages.length === 0 ? (
            <EmptyState userName={userName} onPick={(s) => submit(s)} />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {sendMessage.isPending ? (
            <div className='flex items-start gap-1.5'>
              <SteelIcon
                icon={SparklesIcon}
                strokeWidth={2}
                className='mt-0.5 size-3.5 shrink-0 animate-pulse text-primary'
              />
              <p className='text-muted-foreground text-xs'>
                Consultando workspace…
              </p>
            </div>
          ) : null}
        </div>
      )}

      {!showHistory ? (
        <div className='shrink-0 border-t border-border p-2.5'>
          {pendingAttachments.length > 0 ? (
            <div className='mb-2 flex flex-wrap gap-1.5'>
              {pendingAttachments.map((f, i) => (
                <span
                  key={f.id}
                  className='flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs'
                >
                  <SteelIcon
                    icon={f.kind === 'IMAGE' ? Image01Icon : File01Icon}
                    strokeWidth={2}
                    className='size-3.5 shrink-0 text-muted-foreground'
                  />
                  <span className='max-w-[120px] truncate'>{f.filename}</span>
                  <button
                    type='button'
                    aria-label={`Remover ${f.filename}`}
                    onClick={() =>
                      setPendingAttachments((prev) =>
                        prev.filter((_, j) => j !== i),
                      )
                    }
                    className='text-muted-foreground hover:text-foreground'
                  >
                    <SteelIcon
                      icon={Cancel01Icon}
                      strokeWidth={2}
                      className='size-3.5'
                    />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className='flex items-end gap-2'>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp,application/pdf,text/plain'
              className='hidden'
              onChange={handleFileSelect}
            />
            <Button
              variant='outline'
              size='icon'
              aria-label='Anexar arquivo'
              disabled={sendMessage.isPending || uploadAttachment.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <SteelIcon icon={Attachment01Icon} strokeWidth={2} />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder='Escreva sua mensagem…'
              rows={1}
              className='max-h-28 min-h-9 flex-1 resize-none'
            />
            <Button
              size='icon'
              aria-label='Enviar'
              disabled={!draft.trim() || sendMessage.isPending}
              onClick={() => submit()}
            >
              <SteelIcon
                icon={sendMessage.isPending ? Loading03Icon : Sent02Icon}
                strokeWidth={2}
                className={cn(sendMessage.isPending && 'animate-spin')}
              />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EmptyState({
  userName,
  onPick,
}: {
  userName: string
  onPick: (s: string) => void
}) {
  const firstName = userName.split(' ')[0] || 'por aqui'
  return (
    <div className='flex h-full flex-col items-center justify-center gap-4 px-2 text-center'>
      <span className='flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary [&_svg]:size-6'>
        <SteelIcon icon={SparklesIcon} strokeWidth={2} />
      </span>
      <div className='space-y-1'>
        <p className='font-medium text-sm'>Olá, {firstName} 👋</p>
        <p className='text-muted-foreground text-xs'>
          Consulto dados reais do workspace — CRM, propostas e campanhas de
          e-mail — para análises embasadas.
        </p>
      </div>
      <div className='flex w-full flex-col gap-1.5'>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type='button'
            onClick={() => onPick(s)}
            className='rounded-lg border border-border bg-background/40 px-3 py-2 text-left text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground'
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: CrmAiMessageDTO }) {
  const isUser = message.role === 'USER'
  const hasAttachments = !!message.attachments?.length

  return (
    <div className={cn('flex gap-2', isUser && 'justify-end')}>
      {!isUser ? (
        <span className='mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary [&_svg]:size-3.5'>
          <SteelIcon icon={SparklesIcon} strokeWidth={2} />
        </span>
      ) : null}
      <div
        className={cn(
          'flex max-w-[82%] flex-col gap-1.5',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {hasAttachments ? (
          <div
            className={cn(
              'flex flex-wrap gap-1.5',
              isUser ? 'justify-end' : 'justify-start',
            )}
          >
            {message.attachments?.map((a) => (
              <AttachmentBubble key={a.id} attachment={a} />
            ))}
          </div>
        ) : null}
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : 'rounded-bl-sm bg-muted text-foreground',
          )}
        >
          {isUser ? (
            <span className='whitespace-pre-wrap'>{message.content}</span>
          ) : (
            <div className='prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8em] dark:[&_code]:bg-white/15 [&_pre]:rounded-lg [&_pre]:bg-black/10 [&_pre]:p-3 dark:[&_pre]:bg-white/10 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_p]:my-1 [&_h1]:font-semibold [&_h1]:text-base [&_h2]:font-semibold [&_h2]:text-sm [&_h3]:font-medium [&_h3]:text-sm [&_blockquote]:border-current [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:opacity-70 [&_strong]:font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_hr]:border-current [&_hr]:opacity-20 [&_table]:w-full [&_th]:text-left [&_th]:font-medium [&_td]:py-1'>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AttachmentBubble({ attachment }: { attachment: CrmAiAttachmentDTO }) {
  if (attachment.kind === 'IMAGE' && attachment.url) {
    return (
      <a
        href={attachment.url}
        target='_blank'
        rel='noreferrer'
        className='block'
      >
        <img
          src={attachment.url}
          alt={attachment.filename}
          className='max-h-28 rounded-lg border border-border object-cover'
        />
      </a>
    )
  }

  const chip = (
    <span className='flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-foreground text-xs'>
      <SteelIcon
        icon={attachment.kind === 'IMAGE' ? Image01Icon : File01Icon}
        strokeWidth={2}
        className='size-3.5 shrink-0 text-muted-foreground'
      />
      <span className='max-w-[160px] truncate'>{attachment.filename}</span>
    </span>
  )
  return attachment.url ? (
    <a href={attachment.url} target='_blank' rel='noreferrer'>
      {chip}
    </a>
  ) : (
    chip
  )
}
