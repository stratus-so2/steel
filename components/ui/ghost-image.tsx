'use client'

import { Upload04Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

export type GhostImageProps = {
  value?: string
  onUpload: (file: File) => void | Promise<void>
  readOnly?: boolean
  alt?: string
  className?: string
  uploading?: boolean
}

/**
 * Imagem que vira "hover pra trocar" no modo de edição — sem formulário
 * separado, o upload acontece direto em cima da imagem renderizada.
 * `readOnly` (preview público) renderiza só o `<img>`, sem overlay.
 */
export function GhostImage({
  value,
  onUpload,
  readOnly,
  alt = '',
  className,
  uploading,
}: GhostImageProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const isUploading = uploading ?? busy

  if (readOnly) {
    if (!value) return null
    return <img src={value} alt={alt} className={className} />
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
      aria-label={value ? 'Alterar imagem' : 'Adicionar imagem'}
    >
      {value ? (
        <img src={value} alt={alt} className='h-full w-full object-cover' />
      ) : (
        <span className='flex flex-col items-center gap-1 text-muted-foreground text-xs'>
          <SteelIcon icon={Upload04Icon} strokeWidth={2} size={20} />
          Adicionar imagem
        </span>
      )}
      <div className='absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs opacity-0 transition-opacity group-hover:opacity-100'>
        {isUploading ? 'Enviando…' : 'Alterar imagem'}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
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
