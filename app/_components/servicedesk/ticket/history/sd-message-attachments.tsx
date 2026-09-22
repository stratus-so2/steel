'use client'

import { Download01Icon, File02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { SdTicketAttachmentDTO } from '@/types/sd-ticket-message'
import { formatBytes } from '../shared/sd-tab-format'

export function sdAttachmentDownloadUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}download=1`
}

/** Anexos de uma mensagem: imagem (miniatura + prévia), vídeo, áudio, arquivo. */
export function SdMessageAttachments({
  attachments,
  className,
}: {
  attachments: SdTicketAttachmentDTO[]
  className?: string
}) {
  const [preview, setPreview] = useState<SdTicketAttachmentDTO | null>(null)
  if (attachments.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {attachments.map((a) => {
        if (a.kind === 'IMAGE') {
          return (
            <button
              key={a.id}
              type='button'
              onClick={() => setPreview(a)}
              className='block w-fit overflow-hidden rounded-md border border-border'
              aria-label={`Ver ${a.fileName}`}
            >
              <img
                src={a.url}
                alt={a.fileName}
                loading='lazy'
                className='max-h-48 max-w-64 object-cover'
              />
            </button>
          )
        }
        if (a.kind === 'VIDEO') {
          return (
            // biome-ignore lint/a11y/useMediaCaption: vídeo enviado pelo usuário, sem legendas
            <video
              key={a.id}
              src={a.url}
              controls
              preload='metadata'
              className='max-h-64 max-w-full rounded-md border border-border'
            />
          )
        }
        if (a.kind === 'AUDIO') {
          return (
            // biome-ignore lint/a11y/useMediaCaption: áudio enviado pelo usuário, sem legendas
            <audio
              key={a.id}
              src={a.url}
              controls
              preload='metadata'
              className='w-64 max-w-full'
            />
          )
        }
        return (
          <a
            key={a.id}
            href={sdAttachmentDownloadUrl(a.url)}
            className='flex w-fit max-w-full items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted'
          >
            <SteelIcon icon={File02Icon} size={16} />
            <span className='truncate font-medium'>{a.fileName}</span>
            <span className='shrink-0 text-muted-foreground'>
              {formatBytes(a.size)}
            </span>
            <SteelIcon icon={Download01Icon} size={14} />
          </a>
        )
      })}

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      >
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle className='truncate'>{preview?.fileName}</DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className='flex flex-col items-center gap-3'>
              <img
                src={preview.url}
                alt={preview.fileName}
                className='max-h-[70vh] max-w-full rounded-md object-contain'
              />
              <a
                href={sdAttachmentDownloadUrl(preview.url)}
                className='flex items-center gap-1.5 text-primary text-sm hover:underline'
              >
                <SteelIcon icon={Download01Icon} size={14} />
                Baixar ({formatBytes(preview.size)})
              </a>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
