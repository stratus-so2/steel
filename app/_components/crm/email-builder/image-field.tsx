'use client'

import {
  CloudUploadIcon,
  Delete02Icon,
  Image01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import { uploadCrmEmailImage } from '@/src/hooks/use-crm-email-builder'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Image of a block: upload to storage (≤ 5 MB) or paste a URL, plus alt. */
export function ImageField({
  id,
  workspaceId,
  label,
  src,
  alt,
  onChange,
}: {
  id: string
  workspaceId: string
  label: string
  src: string
  alt: string
  onChange: (next: { src?: string; alt?: string }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      notify.error('Formato não suportado. Use JPEG, PNG ou WebP')
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      notify.error('Arquivo muito grande. Máximo 5 MB')
      return
    }
    setUploading(true)
    try {
      const { url } = await uploadCrmEmailImage(workspaceId, file)
      onChange({ src: url, alt: alt || file.name.replace(/\.[^.]+$/, '') })
    } catch (error) {
      notify.error(error)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className='grid gap-2'>
      <Label htmlFor={`${id}-url`} className='text-muted-foreground text-xs'>
        {label}
      </Label>
      <div className='flex min-w-0 items-center gap-3'>
        <div className='flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted'>
          {src ? (
            <img src={src} alt={alt} className='size-full object-cover' />
          ) : (
            <SteelIcon
              icon={Image01Icon}
              strokeWidth={2}
              className='text-muted-foreground'
            />
          )}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <SteelIcon icon={CloudUploadIcon} strokeWidth={2} />
            {uploading ? 'Enviando…' : 'Enviar imagem'}
          </Button>
          {src ? (
            <Button
              type='button'
              size='sm'
              variant='ghost'
              onClick={() => onChange({ src: '' })}
            >
              <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              Remover
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type='file'
          accept={IMAGE_TYPES.join(',')}
          className='hidden'
          aria-label={`Arquivo de ${label.toLowerCase()}`}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <Input
        id={`${id}-url`}
        value={src}
        onChange={(e) => onChange({ src: e.target.value })}
        placeholder='https://… (ou envie um arquivo)'
      />
      <Input
        aria-label='Texto alternativo'
        value={alt}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder='Texto alternativo (acessibilidade)'
        maxLength={200}
      />
    </div>
  )
}
