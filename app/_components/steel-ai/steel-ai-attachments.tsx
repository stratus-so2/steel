'use client'

import {
  Alert02Icon,
  Cancel01Icon,
  File01Icon,
  Loading03Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import {
  useDeleteSteelAiAttachment,
  useUploadSteelAiAttachment,
} from '@/src/hooks/use-steel-ai'
import type { AiAttachmentDTO, AiCapabilitiesDTO } from '@/types/steel-ai'

export type SteelAiAttachmentLimits = AiCapabilitiesDTO['attachments']

/** Same limits the server enforces, used before any request. */
export const STEEL_AI_DEFAULT_ATTACHMENT_LIMITS: SteelAiAttachmentLimits = {
  maxPerMessage: 5,
  maxImageBytes: 5 * 1024 * 1024,
  maxDocumentBytes: 10 * 1024 * 1024,
  accept: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'text/markdown',
    '.md',
    '.csv',
    '.txt',
    '.docx',
  ],
}

export interface SteelAiDraftAttachment {
  localId: string
  name: string
  size: number
  isImage: boolean
  /** Object URL for an image thumbnail before/while uploading. */
  previewUrl: string | null
  status: 'queued' | 'uploading' | 'ready' | 'error'
  attachment: AiAttachmentDTO | null
  error: string | null
  file: File
}

const IMAGE = /^image\/(png|jpeg|webp|gif)$/

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Whether `file` matches the `accept` list (MIME or extension). */
export function isAcceptedFile(file: File, accept: string[]): boolean {
  const type = file.type.toLowerCase()
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  return accept.some((entry) =>
    entry.startsWith('.') ? entry === ext : entry === type,
  )
}

/** pt-BR reason a file cannot be attached, or null when it can. */
export function validateSteelAiFile(
  file: File,
  limits: SteelAiAttachmentLimits,
): string | null {
  if (!isAcceptedFile(file, limits.accept)) {
    return `“${file.name}”: tipo não suportado. Envie imagens (PNG, JPG, WebP, GIF) ou documentos (PDF, DOCX, TXT, CSV, Markdown).`
  }
  if (file.size === 0) return `“${file.name}” está vazio.`
  const max = IMAGE.test(file.type)
    ? limits.maxImageBytes
    : limits.maxDocumentBytes
  if (file.size > max) {
    return `“${file.name}” passa do limite de ${formatBytes(max)}.`
  }
  return null
}

let seq = 0

/**
 * Files picked in the composer. With a conversation they upload right away;
 * without one (welcome screen) they wait as `queued` until `uploadAll`
 * runs after the conversation is created.
 */
export function useSteelAiDraftAttachments({
  workspaceId,
  conversationId,
  limits = STEEL_AI_DEFAULT_ATTACHMENT_LIMITS,
  onReject,
}: {
  workspaceId: string
  conversationId: string | null
  limits?: SteelAiAttachmentLimits
  onReject?: (message: string) => void
}) {
  const [items, setItems] = useState<SteelAiDraftAttachment[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const upload = useUploadSteelAiAttachment(workspaceId)
  const remove = useDeleteSteelAiAttachment(workspaceId)

  const patch = useCallback(
    (localId: string, next: Partial<SteelAiDraftAttachment>) =>
      setItems((list) =>
        list.map((item) =>
          item.localId === localId ? { ...item, ...next } : item,
        ),
      ),
    [],
  )

  const uploadOne = useCallback(
    async (
      item: SteelAiDraftAttachment,
      targetId: string,
    ): Promise<AiAttachmentDTO | null> => {
      patch(item.localId, { status: 'uploading', error: null })
      try {
        const attachment = await upload.mutateAsync({
          conversationId: targetId,
          file: item.file,
        })
        patch(item.localId, { status: 'ready', attachment })
        return attachment
      } catch (error) {
        patch(item.localId, {
          status: 'error',
          error:
            error instanceof Error ? error.message : 'Erro ao enviar o anexo',
        })
        return null
      }
    },
    [patch, upload.mutateAsync],
  )

  const add = useCallback(
    (files: File[]) => {
      const room = limits.maxPerMessage - itemsRef.current.length
      if (files.length > room) {
        onReject?.(`No máximo ${limits.maxPerMessage} anexos por mensagem.`)
      }
      const accepted: SteelAiDraftAttachment[] = []
      for (const file of files.slice(0, Math.max(0, room))) {
        const problem = validateSteelAiFile(file, limits)
        if (problem) {
          onReject?.(problem)
          continue
        }
        const isImage = IMAGE.test(file.type)
        seq += 1
        accepted.push({
          localId: `att_${seq}`,
          name: file.name,
          size: file.size,
          isImage,
          previewUrl:
            isImage && typeof URL.createObjectURL === 'function'
              ? URL.createObjectURL(file)
              : null,
          status: 'queued',
          attachment: null,
          error: null,
          file,
        })
      }
      if (accepted.length === 0) return
      setItems((list) => [...list, ...accepted])
      if (conversationId) {
        for (const item of accepted) void uploadOne(item, conversationId)
      }
    },
    [conversationId, limits, onReject, uploadOne],
  )

  const discard = useCallback(
    (localId: string) => {
      const item = itemsRef.current.find((i) => i.localId === localId)
      if (!item) return
      if (item.previewUrl) URL.revokeObjectURL?.(item.previewUrl)
      setItems((list) => list.filter((i) => i.localId !== localId))
      if (item.attachment && conversationId) {
        remove.mutate({
          conversationId,
          attachmentId: item.attachment.id,
        })
      }
    },
    [conversationId, remove.mutate],
  )

  /** Forgets the draft after a send (the files now belong to the message). */
  const clear = useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.previewUrl) URL.revokeObjectURL?.(item.previewUrl)
    }
    setItems([])
  }, [])

  /** Uploads what is still queued (welcome screen, after creating the chat). */
  const uploadAll = useCallback(
    async (targetId: string): Promise<AiAttachmentDTO[] | null> => {
      const results = await Promise.all(
        itemsRef.current.map((item) =>
          item.attachment ? item.attachment : uploadOne(item, targetId),
        ),
      )
      return results.every(Boolean) ? (results as AiAttachmentDTO[]) : null
    },
    [uploadOne],
  )

  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL?.(item.previewUrl)
      }
    },
    [],
  )

  const ready = items
    .map((item) => item.attachment)
    .filter((a): a is AiAttachmentDTO => a !== null)

  return {
    items,
    add,
    discard,
    clear,
    uploadAll,
    ready,
    isUploading: items.some((i) => i.status === 'uploading'),
    hasErrors: items.some((i) => i.status === 'error'),
  }
}

function Thumb({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      className={cn('size-full object-cover', className)}
    />
  )
}

function DocChip({
  name,
  size,
  className,
}: {
  name: string
  size: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex h-12 min-w-0 max-w-52 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-left',
        className,
      )}
    >
      <SteelIcon
        icon={File01Icon}
        strokeWidth={2}
        className='size-4 shrink-0 text-muted-foreground'
      />
      <span className='min-w-0'>
        <span className='block truncate font-medium text-xs'>{name}</span>
        <span className='block text-[11px] text-muted-foreground'>
          {formatBytes(size)}
        </span>
      </span>
    </span>
  )
}

/** Files waiting in the composer, each with a remove button. */
export function SteelAiAttachmentTray({
  items,
  onRemove,
  disabled,
}: {
  items: SteelAiDraftAttachment[]
  onRemove: (localId: string) => void
  disabled?: boolean
}) {
  if (items.length === 0) return null
  return (
    <ul
      aria-label='Anexos da mensagem'
      className='flex flex-wrap gap-2 px-3 pt-3'
    >
      {items.map((item) => (
        <li
          key={item.localId}
          data-status={item.status}
          title={item.error ?? item.name}
          className='group relative'
        >
          {item.isImage && (item.previewUrl || item.attachment) ? (
            <span className='block size-12 overflow-hidden rounded-lg border border-border bg-muted'>
              <Thumb
                src={
                  item.previewUrl ?? (item.attachment as AiAttachmentDTO).url
                }
                alt={item.name}
                className={cn(item.status !== 'ready' && 'opacity-60')}
              />
            </span>
          ) : (
            <DocChip
              name={item.name}
              size={item.size}
              className={cn(item.status === 'error' && 'border-destructive/50')}
            />
          )}
          {item.status === 'uploading' ? (
            <span className='absolute inset-0 flex items-center justify-center rounded-lg bg-background/40'>
              <SteelIcon
                icon={Loading03Icon}
                strokeWidth={2}
                className='size-4 motion-safe:animate-spin'
              />
            </span>
          ) : null}
          {item.status === 'error' ? (
            <span className='absolute bottom-1 left-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white'>
              <SteelIcon
                icon={Alert02Icon}
                strokeWidth={2}
                className='size-3'
              />
            </span>
          ) : null}
          <button
            type='button'
            aria-label={`Remover ${item.name}`}
            disabled={disabled}
            onClick={() => onRemove(item.localId)}
            className='-top-1.5 -right-1.5 absolute flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs hover:text-foreground disabled:opacity-50'
          >
            <SteelIcon icon={Cancel01Icon} strokeWidth={2} className='size-3' />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Files of a sent message: thumbnails for photos, chips for documents. */
export function SteelAiMessageAttachments({
  attachments,
  className,
}: {
  attachments: AiAttachmentDTO[]
  className?: string
}) {
  if (attachments.length === 0) return null
  return (
    <ul
      aria-label='Anexos'
      className={cn('flex flex-wrap justify-end gap-2', className)}
    >
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <a
            href={attachment.url}
            target='_blank'
            rel='noopener noreferrer'
            className='block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
          >
            {attachment.kind === 'IMAGE' ? (
              <span className='block size-24 overflow-hidden rounded-lg border border-border bg-muted sm:size-28'>
                <Thumb src={attachment.url} alt={attachment.filename} />
              </span>
            ) : (
              <DocChip name={attachment.filename} size={attachment.sizeBytes} />
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}
