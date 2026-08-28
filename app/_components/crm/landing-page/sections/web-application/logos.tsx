'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type LogosContent = Extract<CrmLandingPageSectionContent, { type: 'LOGOS' }>

const BASE = '/landing-page-templates/web-application'

export function logosDefaultContent(): LogosContent {
  return {
    type: 'LOGOS',
    logos: [
      { name: 'MakeLess', imageUrl: `${BASE}/logo-1.png` },
      { name: 'coworks', imageUrl: `${BASE}/logo-2.png` },
      { name: 'greener', imageUrl: `${BASE}/logo-3.png` },
      { name: 'SaaS Today', imageUrl: `${BASE}/logo-4.png` },
      { name: 'Dorfus', imageUrl: `${BASE}/logo-5.png` },
      { name: 'askimat', imageUrl: `${BASE}/logo-6.png` },
    ],
  }
}

export function WebApplicationLogos({
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
    <section className='border-[#161c2d]/10 border-b bg-white px-6 py-8 sm:px-10 lg:px-[123px]'>
      {content.title || !readOnly ? (
        <GhostInput
          value={content.title ?? ''}
          onCommit={(v) => onChange?.({ ...content, title: v || undefined })}
          placeholder='Título da seção'
          readOnly={readOnly}
          className='mb-6 text-center text-[#161c2d]/60 text-sm'
        />
      ) : null}

      <div className='mx-auto flex max-w-[1350px] flex-wrap items-center justify-center gap-x-14 gap-y-6'>
        {content.logos.map((logo, index) => (
          <div key={index} className='group/item relative'>
            {!readOnly ? (
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                className='-top-3 -right-3 absolute z-10 opacity-0 group-hover/item:opacity-100'
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
              className='h-8 w-36 opacity-80'
            />
            {!readOnly ? (
              <GhostInput
                value={logo.name}
                onCommit={(v) => updateLogo(index, v)}
                placeholder='Nome da empresa'
                readOnly={readOnly}
                className='mt-1 text-center text-[#161c2d]/60 text-xs'
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
