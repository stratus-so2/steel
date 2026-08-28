'use client'

import { Upload04Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

export type GhostVideoProps = {
  value?: string
  onUpload: (file: File) => void | Promise<void>
  readOnly?: boolean
  className?: string
  uploading?: boolean
}

/**
 * Mesmo padrão do `GhostImage` (hover pra trocar, upload direto em cima do
 * elemento renderizado), mas pra vídeo — sempre autoplay/mudo/loop/sem
 * controles (banner de fundo, não player de conteúdo).
 */
export function GhostVideo({
  value,
  onUpload,
  readOnly,
  className,
  uploading,
}: GhostVideoProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const isUploading = uploading ?? busy

  if (readOnly) {
    if (!value) return null
    return (
      <video
        src={value}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        className={className}
      />
    )
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      await onUpload(file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-center justify-center overflow-hidden bg-muted/40',
        className,
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      role='button'
      tabIndex={0}
      aria-label={value ? 'Alterar vídeo' : 'Adicionar vídeo'}
    >
      {value ? (
        <video
          src={value}
          autoPlay
          muted
          loop
          playsInline
          controls={false}
          className='h-full w-full object-cover'
        />
      ) : (
        <span className='flex flex-col items-center gap-1 text-muted-foreground text-xs'>
          <SteelIcon icon={Upload04Icon} strokeWidth={2} size={20} />
          Adicionar vídeo
        </span>
      )}
      <div className='absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs opacity-0 transition-opacity group-hover:opacity-100'>
        {isUploading ? 'Enviando…' : 'Alterar vídeo'}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept='video/mp4,video/webm'
        className='hidden'
        disabled={isUploading}
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
