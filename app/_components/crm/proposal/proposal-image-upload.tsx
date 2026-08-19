'use client'

import { Cancel01Icon, Upload04Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { uploadCrmProposalImage } from '@/src/hooks/use-crm-proposal'

async function pickAndUpload(
  workspaceId: string,
  file: File,
): Promise<string | null> {
  const res = await uploadCrmProposalImage(workspaceId, file)
  if (!res.ok || !res.data) {
    notify.error(res.message ?? 'Não foi possível enviar a imagem.')
    return null
  }
  return res.data.url
}

/** Slot de imagem única (ex.: capa, assinatura). */
export function ImageUploadField({
  workspaceId,
  label,
  value,
  onChange,
}: {
  workspaceId: string
  label: string
  value?: string
  onChange: (url: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    const url = await pickAndUpload(workspaceId, file)
    setUploading(false)
    if (url) onChange(url)
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='font-medium text-sm'>{label}</span>
      {value ? (
        <div className='group relative w-fit'>
          <img
            src={value}
            alt={label}
            className='h-32 w-auto rounded-md border object-cover'
          />
          <Button
            type='button'
            variant='secondary'
            size='icon-xs'
            className='-right-2 -top-2 absolute'
            aria-label='Remover imagem'
            onClick={() => onChange(undefined)}
          >
            <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </div>
      ) : (
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='w-fit'
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <SteelIcon icon={Upload04Icon} strokeWidth={2} />
          {uploading ? 'Enviando…' : 'Enviar imagem'}
        </Button>
      )}
      <input
        ref={inputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        className='hidden'
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}

/** Galeria de imagens (ex.: fotos da empresa, da solução), até `max`. */
export function ImageGalleryField({
  workspaceId,
  label,
  value,
  onChange,
  max = 6,
}: {
  workspaceId: string
  label: string
  value: string[]
  onChange: (urls: string[]) => void
  max?: number
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (value.length >= max) {
      notify.error(`Máximo de ${max} imagens.`)
      return
    }
    setUploading(true)
    const url = await pickAndUpload(workspaceId, file)
    setUploading(false)
    if (url) onChange([...value, url])
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url))
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='font-medium text-sm'>
        {label}{' '}
        <span className='text-muted-foreground text-xs'>
          ({value.length}/{max})
        </span>
      </span>
      <div className='flex flex-wrap gap-2'>
        {value.map((url) => (
          <div key={url} className='group relative'>
            <img
              src={url}
              alt={label}
              className='h-20 w-20 rounded-md border object-cover'
            />
            <Button
              type='button'
              variant='secondary'
              size='icon-xs'
              className='-right-2 -top-2 absolute'
              aria-label='Remover imagem'
              onClick={() => remove(url)}
            >
              <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </div>
        ))}
        {value.length < max ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-20 w-20 flex-col'
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <SteelIcon icon={Upload04Icon} strokeWidth={2} />
            {uploading ? '…' : 'Adicionar'}
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        className='hidden'
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
