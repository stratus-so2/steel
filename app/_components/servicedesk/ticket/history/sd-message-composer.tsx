'use client'

import {
  Attachment01Icon,
  Cancel01Icon,
  File02Icon,
  FlashIcon,
  SentIcon,
  SmileIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import {
  type ClipboardEvent,
  type DragEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from '@/components/ui/emoji-picker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { SD_TONE } from '../sd-ticket-meta'
import { useSdAgents, useSdConfig } from '@/src/hooks/use-sd-config'
import {
  useDeleteSdTicketAttachment,
  useSendSdTicketMessage,
  useUploadSdTicketAttachment,
} from '@/src/hooks/use-sd-ticket-messages'
import type { SdCannedResponseDTO } from '@/types/sd-config'
import type {
  SdMessageVisibilityDTO,
  SdTicketAttachmentDTO,
} from '@/types/sd-ticket-message'
import { formatBytes } from '../shared/sd-tab-format'

/** Limite por arquivo (o servidor confere de novo). */
export const SD_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024
const MAX_ATTACHMENTS = 10

interface PendingFile {
  key: string
  file: File
  status: 'uploading' | 'done' | 'error'
  attachment?: SdTicketAttachmentDTO
}

/** Respostas prontas que casam com `query` (atalho ou título). */
export function filterSdCannedResponses(
  responses: SdCannedResponseDTO[],
  query: string,
): SdCannedResponseDTO[] {
  const q = query.trim().toLowerCase()
  if (!q) return responses
  return responses.filter(
    (r) =>
      r.shortcut?.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q),
  )
}

/** Token `@alguem` no fim do texto (menção em andamento). */
export function sdMentionQuery(text: string): string | null {
  const match = /(^|\s)@([\p{L}\p{N}._-]*)$/u.exec(text)
  return match ? (match[2] ?? '') : null
}

/**
 * Ids dos agentes escolhidos no `@` que **continuam** citados no texto: o
 * usuário pode apagar a menção depois de escolher, e aí ela não deve ir
 * para o servidor. Compara pelo nome inserido (`@Nome`).
 */
export function sdResolveMentions(
  text: string,
  picked: { id: string; name: string }[],
): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const agent of picked) {
    if (seen.has(agent.id)) continue
    if (!text.includes(`@${agent.name}`)) continue
    seen.add(agent.id)
    ids.push(agent.id)
  }
  return ids
}

let pendingSeq = 0

export function SdMessageComposer({
  workspaceId,
  ticketRef,
  mode,
  disabled,
  disabledReason,
}: {
  workspaceId: string
  ticketRef: string
  mode: 'agent' | 'requester'
  disabled?: boolean
  disabledReason?: string
}) {
  const isAgent = mode === 'agent'
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<SdMessageVisibilityDTO>('PUBLIC')
  const [pending, setPending] = useState<PendingFile[]>([])
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [cannedOpen, setCannedOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const config = useSdConfig(isAgent ? workspaceId : '')
  const agents = useSdAgents(workspaceId, { enabled: isAgent })
  const send = useSendSdTicketMessage(workspaceId, ticketRef)
  const upload = useUploadSdTicketAttachment(workspaceId, ticketRef)
  const removeAttachment = useDeleteSdTicketAttachment(workspaceId, ticketRef)

  const canned = config.data?.cannedResponses ?? []
  const slashQuery = isAgent && text.startsWith('/') ? text.slice(1) : null
  const slashMatches = useMemo(
    () =>
      slashQuery === null ? [] : filterSdCannedResponses(canned, slashQuery),
    [canned, slashQuery],
  )
  const mention = isAgent ? sdMentionQuery(text) : null
  const mentionMatches = useMemo(() => {
    if (mention === null) return []
    const q = mention.toLowerCase()
    return (agents.data ?? [])
      .filter((a) => a.isAgent && a.name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [agents.data, mention])

  const uploading = pending.some((p) => p.status === 'uploading')
  const readyIds = pending
    .filter((p) => p.status === 'done' && p.attachment)
    .map((p) => p.attachment?.id as string)
  const canSend =
    !disabled &&
    !uploading &&
    !send.isPending &&
    (text.trim().length > 0 || readyIds.length > 0)

  function addFiles(files: FileList | File[] | null) {
    if (!files || disabled) return
    const list = Array.from(files)
    const room = MAX_ATTACHMENTS - pending.length
    if (list.length > room) {
      notify.warning(`No máximo ${MAX_ATTACHMENTS} anexos por mensagem`)
    }
    for (const file of list.slice(0, Math.max(0, room))) {
      if (file.size > SD_ATTACHMENT_MAX_BYTES) {
        notify.error(`${file.name} passa de 25 MB`)
        continue
      }
      pendingSeq += 1
      const key = `f${pendingSeq}`
      setPending((prev) => [...prev, { key, file, status: 'uploading' }])
      upload.mutate(file, {
        onSuccess: (attachment) =>
          setPending((prev) =>
            prev.map((p) =>
              p.key === key ? { ...p, status: 'done', attachment } : p,
            ),
          ),
        onError: (error) => {
          notify.error(error, `Não foi possível enviar ${file.name}`)
          setPending((prev) =>
            prev.map((p) => (p.key === key ? { ...p, status: 'error' } : p)),
          )
        },
      })
    }
  }

  function discard(item: PendingFile) {
    setPending((prev) => prev.filter((p) => p.key !== item.key))
    if (item.attachment) removeAttachment.mutate(item.attachment.id)
  }

  async function submit() {
    if (!canSend) return
    try {
      await send.mutateAsync({
        body: text.trim(),
        visibility: isAgent ? visibility : 'PUBLIC',
        attachmentIds: readyIds,
        mentionedUserIds: sdResolveMentions(text, picked),
      })
      setText('')
      setPending([])
      setPicked([])
    } catch (error) {
      notify.error(error, 'Erro ao enviar a mensagem')
    }
  }

  function applyCanned(response: SdCannedResponseDTO) {
    setText(response.body)
    setCannedOpen(false)
  }

  function applyMention(agent: { id: string; name: string }) {
    setText((current) =>
      current.replace(/@[\p{L}\p{N}._-]*$/u, `@${agent.name} `),
    )
    setPicked((current) =>
      current.some((a) => a.id === agent.id)
        ? current
        : [...current, { id: agent.id, name: agent.name }],
    )
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData?.files ?? [])
    if (files.length > 0) {
      e.preventDefault()
      addFiles(files)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer?.files ?? null)
  }

  if (disabled && disabledReason) {
    return (
      <p className='border-border border-t px-4 py-3 text-center text-muted-foreground text-sm'>
        {disabledReason}
      </p>
    )
  }

  const internal = isAgent && visibility === 'INTERNAL'

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 border-border border-t p-3',
        internal && 'bg-amber-500/5',
        dragging && 'ring-2 ring-primary ring-inset',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      data-testid='sd-composer'
    >
      {isAgent ? (
        <div className='flex gap-1' role='radiogroup' aria-label='Visibilidade'>
          <Button
            type='button'
            size='xs'
            role='radio'
            aria-checked={visibility === 'PUBLIC'}
            variant={visibility === 'PUBLIC' ? 'secondary' : 'ghost'}
            onClick={() => setVisibility('PUBLIC')}
          >
            Público
          </Button>
          <Button
            type='button'
            size='xs'
            role='radio'
            aria-checked={visibility === 'INTERNAL'}
            variant={visibility === 'INTERNAL' ? 'secondary' : 'ghost'}
            className={cn(visibility === 'INTERNAL' && SD_TONE.amber)}
            onClick={() => setVisibility('INTERNAL')}
          >
            Nota interna
          </Button>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <ul className='flex flex-wrap gap-1.5' aria-label='Anexos a enviar'>
          {pending.map((p) => (
            <li
              key={p.key}
              className={cn(
                'flex max-w-56 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs',
                p.status === 'error' && 'border-destructive text-destructive',
              )}
            >
              <SteelIcon icon={File02Icon} size={14} />
              <span className='truncate'>{p.file.name}</span>
              <span className='shrink-0 text-muted-foreground'>
                {p.status === 'uploading'
                  ? 'enviando…'
                  : p.status === 'error'
                    ? 'falhou'
                    : formatBytes(p.file.size)}
              </span>
              <button
                type='button'
                aria-label={`Remover ${p.file.name}`}
                onClick={() => discard(p)}
                className='shrink-0 text-muted-foreground hover:text-foreground'
              >
                <SteelIcon icon={Cancel01Icon} size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className='relative'>
        {slashQuery !== null && slashMatches.length > 0 ? (
          <div
            role='listbox'
            aria-label='Respostas prontas'
            className='absolute bottom-full left-0 z-20 mb-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md'
          >
            {slashMatches.map((r) => (
              <div key={r.id}>
                <button
                  type='button'
                  role='option'
                  aria-selected={false}
                  onClick={() => applyCanned(r)}
                  className='flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted'
                >
                  <span className='font-medium'>
                    {r.shortcut ? `/${r.shortcut} · ` : ''}
                    {r.title}
                  </span>
                  <span className='line-clamp-1 text-muted-foreground text-xs'>
                    {r.body}
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {mention !== null && mentionMatches.length > 0 ? (
          <div
            role='listbox'
            aria-label='Mencionar agente'
            className='absolute bottom-full left-0 z-20 mb-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md'
          >
            {mentionMatches.map((a) => (
              <div key={a.id}>
                <button
                  type='button'
                  role='option'
                  aria-selected={false}
                  onClick={() => applyMention(a)}
                  className='w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted'
                >
                  {a.name}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (slashQuery !== null && slashMatches[0]) {
                applyCanned(slashMatches[0])
                return
              }
              void submit()
            }
          }}
          disabled={disabled}
          placeholder={
            internal
              ? 'Nota interna (o solicitante não vê)…'
              : isAgent
                ? 'Escreva uma resposta… ( / para respostas prontas)'
                : 'Escreva uma mensagem…'
          }
          aria-label='Mensagem'
          className='max-h-48 min-h-16 resize-none bg-background'
        />
      </div>

      <div className='flex items-center gap-1'>
        <input
          ref={fileInput}
          type='file'
          multiple
          hidden
          data-testid='sd-composer-file'
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label='Anexar arquivo'
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
        >
          <SteelIcon icon={Attachment01Icon} size={18} />
        </Button>

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger
            render={
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                disabled={disabled}
                aria-label='Emoji'
              >
                <SteelIcon icon={SmileIcon} size={18} />
              </Button>
            }
          />
          <PopoverContent className='h-80 w-72 p-0'>
            <EmojiPicker
              className='h-full'
              onEmojiSelect={({ emoji }) => setText((c) => `${c}${emoji}`)}
            >
              <EmojiPickerSearch />
              <EmojiPickerContent />
              <EmojiPickerFooter />
            </EmojiPicker>
          </PopoverContent>
        </Popover>

        {isAgent ? (
          <Popover open={cannedOpen} onOpenChange={setCannedOpen}>
            <PopoverTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  disabled={disabled}
                  aria-label='Respostas prontas'
                >
                  <SteelIcon icon={FlashIcon} size={18} />
                </Button>
              }
            />
            <PopoverContent className='max-h-72 w-80 overflow-y-auto p-1'>
              {canned.length === 0 ? (
                <p className='p-3 text-muted-foreground text-sm'>
                  Nenhuma resposta pronta cadastrada.
                </p>
              ) : (
                canned.map((r) => (
                  <button
                    key={r.id}
                    type='button'
                    onClick={() => applyCanned(r)}
                    className='flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted'
                  >
                    <span className='font-medium'>{r.title}</span>
                    <span className='line-clamp-2 text-muted-foreground text-xs'>
                      {r.body}
                    </span>
                  </button>
                ))
              )}
            </PopoverContent>
          </Popover>
        ) : null}

        <span className='ml-auto hidden text-[11px] text-muted-foreground sm:inline'>
          Enter envia · Shift+Enter quebra linha
        </span>
        <Button
          type='button'
          size='sm'
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label='Enviar mensagem'
        >
          <SteelIcon icon={SentIcon} />
          {internal ? 'Salvar nota' : 'Enviar'}
        </Button>
      </div>
    </div>
  )
}
