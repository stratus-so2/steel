'use client'

import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from './types'

type TestimonialContent = Extract<
  CrmLandingPageSectionContent,
  { type: 'TESTIMONIAL' }
>

export function testimonialDefaultContent(): TestimonialContent {
  return {
    type: 'TESTIMONIAL',
    quote: 'Depoimento de um cliente satisfeito.',
    authorName: 'Nome do cliente',
  }
}

export function TestimonialSection({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<TestimonialContent>) {
  async function handleImage(file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId ?? '', file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    onChange?.({ ...content, avatarUrl: res.data.url })
  }

  return (
    <section className='flex flex-col items-center gap-6 border-y px-6 py-16 text-center sm:px-12'>
      <GhostTextarea
        value={content.quote}
        onCommit={(v) => onChange?.({ ...content, quote: v })}
        placeholder='Depoimento'
        readOnly={readOnly}
        as='p'
        className='max-w-2xl text-balance font-medium text-lg sm:text-xl'
      />
      <div className='flex items-center gap-3'>
        <GhostImage
          value={content.avatarUrl}
          onUpload={handleImage}
          readOnly={readOnly}
          alt={content.authorName}
          className='size-12 rounded-full'
        />
        <div className='flex flex-col items-start text-left'>
          <GhostInput
            value={content.authorName}
            onCommit={(v) => onChange?.({ ...content, authorName: v })}
            placeholder='Nome'
            readOnly={readOnly}
            className='font-medium text-sm'
          />
          {content.authorRole || !readOnly ? (
            <GhostInput
              value={content.authorRole ?? ''}
              onCommit={(v) =>
                onChange?.({ ...content, authorRole: v || undefined })
              }
              placeholder='Cargo/empresa'
              readOnly={readOnly}
              className='text-muted-foreground text-xs'
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}
