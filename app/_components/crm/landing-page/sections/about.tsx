'use client'

import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from './types'

type AboutContent = Extract<CrmLandingPageSectionContent, { type: 'ABOUT' }>

export function aboutDefaultContent(): AboutContent {
  return { type: 'ABOUT', title: 'Nossa história', description: '' }
}

export function AboutSection({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<AboutContent>) {
  async function handleImage(file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId ?? '', file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    onChange?.({ ...content, imageUrl: res.data.url })
  }

  return (
    <section className='grid grid-cols-1 items-center gap-8 px-6 py-16 sm:px-12 lg:grid-cols-2 lg:gap-16'>
      <GhostImage
        value={content.imageUrl}
        onUpload={handleImage}
        readOnly={readOnly}
        alt={content.title}
        className='aspect-square w-full rounded-2xl lg:order-2'
      />
      <div className='flex flex-col gap-4 lg:order-1'>
        {content.eyebrow || !readOnly ? (
          <GhostInput
            value={content.eyebrow ?? ''}
            onCommit={(v) =>
              onChange?.({ ...content, eyebrow: v || undefined })
            }
            placeholder='Texto de destaque'
            readOnly={readOnly}
            className='font-medium text-primary text-sm'
          />
        ) : null}
        <GhostInput
          as='h2'
          value={content.title}
          onCommit={(v) => onChange?.({ ...content, title: v })}
          placeholder='Título da seção'
          readOnly={readOnly}
          className='text-balance font-semibold text-2xl tracking-tight sm:text-3xl'
        />
        <GhostTextarea
          value={content.description}
          onCommit={(v) => onChange?.({ ...content, description: v })}
          placeholder='Descrição'
          readOnly={readOnly}
          as='p'
          className='text-muted-foreground text-sm sm:text-base'
        />
      </div>
    </section>
  )
}
