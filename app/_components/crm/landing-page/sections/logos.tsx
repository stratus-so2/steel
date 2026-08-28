'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from './types'

type LogosContent = Extract<CrmLandingPageSectionContent, { type: 'LOGOS' }>

export function logosDefaultContent(): LogosContent {
  return { type: 'LOGOS', logos: [] }
}

export function LogosSection({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<LogosContent>) {
  async function handleImage(index: number, file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId ?? '', file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    const url = res.data.url
    onChange?.({
      ...content,
      logos: content.logos.map((l, i) =>
        i === index ? { ...l, imageUrl: url } : l,
      ),
    })
  }

  function updateLogo(index: number, name: string) {
    onChange?.({
      ...content,
      logos: content.logos.map((l, i) => (i === index ? { ...l, name } : l)),
    })
  }

  function addLogo() {
    onChange?.({
      ...content,
      logos: [...content.logos, { name: 'Empresa' }],
    })
  }

  function removeLogo(index: number) {
    onChange?.({
      ...content,
      logos: content.logos.filter((_, i) => i !== index),
    })
  }

  return (
    <section className='flex flex-col items-center gap-8 px-6 py-12 sm:px-12'>
      {content.title || !readOnly ? (
        <GhostInput
          value={content.title ?? ''}
          onCommit={(v) => onChange?.({ ...content, title: v || undefined })}
          placeholder='Título da seção'
          readOnly={readOnly}
          className='text-center text-muted-foreground text-sm'
        />
      ) : null}

      <div className='flex w-full max-w-4xl flex-wrap items-center justify-center gap-8'>
        {content.logos.map((logo, index) => (
          <div key={index} className='group/item relative flex flex-col gap-1'>
            {!readOnly ? (
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                className='-top-2 -right-2 absolute z-10 opacity-0 group-hover/item:opacity-100'
                aria-label='Remover logo'
                onClick={() => removeLogo(index)}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} size={12} />
              </Button>
            ) : null}
            <GhostImage
              value={logo.imageUrl}
              onUpload={(file) => handleImage(index, file)}
              readOnly={readOnly}
              alt={logo.name}
              className='h-8 w-28'
            />
            {!readOnly ? (
              <GhostInput
                value={logo.name}
                onCommit={(v) => updateLogo(index, v)}
                placeholder='Nome da empresa'
                readOnly={readOnly}
                className='text-center text-muted-foreground text-xs'
              />
            ) : null}
          </div>
        ))}
        {!readOnly ? (
          <Button type='button' variant='outline' size='sm' onClick={addLogo}>
            <SteelIcon icon={Add01Icon} strokeWidth={2} />
            Adicionar logo
          </Button>
        ) : null}
      </div>
    </section>
  )
}
