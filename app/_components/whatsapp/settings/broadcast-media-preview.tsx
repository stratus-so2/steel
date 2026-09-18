'use client'

import { File02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import {
  BROADCAST_MEDIA_KIND_LABEL,
  type BroadcastMediaKind,
} from '@/src/lib/whatsapp/broadcast-media'

/** Prévia da mídia da transmissão conforme o tipo que será enviado. */
export function BroadcastMediaPreview({
  kind,
  src,
  fileName,
}: {
  kind: BroadcastMediaKind
  src: string
  fileName?: string | null
}) {
  if (kind === 'IMAGE') {
    return (
      <img
        src={src}
        alt={fileName ?? 'Imagem da transmissão'}
        className='max-h-48 rounded-md border object-contain'
      />
    )
  }
  if (kind === 'VIDEO') {
    return (
      // biome-ignore lint/a11y/useMediaCaption: prévia do vídeo que o próprio usuário anexou
      <video
        src={src}
        controls
        aria-label={fileName ?? 'Vídeo da transmissão'}
        className='max-h-48 w-full rounded-md border'
      />
    )
  }
  if (kind === 'AUDIO') {
    return (
      <div className='space-y-1'>
        {/* biome-ignore lint/a11y/useMediaCaption: prévia do áudio que o próprio usuário anexou */}
        <audio
          src={src}
          controls
          aria-label={fileName ?? 'Áudio da transmissão'}
          className='w-full'
        />
        <p className='text-muted-foreground text-xs'>
          Áudio não tem legenda no WhatsApp: a mensagem é enviada logo depois,
          como texto.
        </p>
      </div>
    )
  }
  return (
    <div className='flex items-center gap-2 rounded-md border p-2 text-sm'>
      <SteelIcon
        icon={File02Icon}
        size={18}
        className='text-muted-foreground'
      />
      <span className='min-w-0 flex-1 truncate'>
        {fileName ?? BROADCAST_MEDIA_KIND_LABEL[kind]}
      </span>
      <span className='text-muted-foreground text-xs'>
        {BROADCAST_MEDIA_KIND_LABEL[kind]}
      </span>
    </div>
  )
}
