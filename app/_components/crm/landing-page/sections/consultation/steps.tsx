'use client'

import { PlayIcon } from '@hugeicons-pro/core-solid-rounded'
import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type StepsContent = Extract<CrmLandingPageSectionContent, { type: 'STEPS' }>

const VIDEO_PREVIEW =
  '/landing-page-templates/consultation/steps-video-preview.png'

export function consultationStepsDefaultContent(): StepsContent {
  return {
    type: 'STEPS',
    title: 'Why you should choose us?',
    subtitle:
      'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
    imageUrl: VIDEO_PREVIEW,
    items: [
      {
        title: 'Easy Booking',
        description:
          'With lots of unique blocks, you can easily build a page without coding.',
      },
      {
        title: 'Free Expert Opinion',
        description:
          'With lots of unique blocks, you can easily build a page without coding.',
      },
      {
        title: 'Get Your Results',
        description:
          'With lots of unique blocks, you can easily build a page without coding.',
      },
    ],
  }
}

export function ConsultationSteps({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<StepsContent>) {
  async function handleImage(file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId ?? '', file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    onChange?.({ ...content, imageUrl: res.data.url })
  }

  function updateItem(
    index: number,
    patch: Partial<{ title: string; description: string }>,
  ) {
    onChange?.({
      ...content,
      items: content.items.map((it, i) =>
        i === index ? { ...it, ...patch } : it,
      ),
    })
  }

  function addItem() {
    onChange?.({
      ...content,
      items: [...content.items, { title: 'Novo passo', description: '' }],
    })
  }

  function removeItem(index: number) {
    onChange?.({
      ...content,
      items: content.items.filter((_, i) => i !== index),
    })
  }

  return (
    <section className='bg-[#f4f7fa] px-6 py-20 sm:px-10 sm:py-28 lg:px-[123px]'>
      <div className='mx-auto mb-16 flex max-w-2xl flex-col items-center gap-4 text-center'>
        <GhostInput
          as='h2'
          value={content.title}
          onCommit={(v) => onChange?.({ ...content, title: v })}
          placeholder='Título da seção'
          readOnly={readOnly}
          className='text-balance font-bold text-[#161c2d] text-[28px] leading-tight tracking-[-1.2px] sm:text-[36px] sm:leading-[48px]'
        />
        {content.subtitle || !readOnly ? (
          <GhostInput
            value={content.subtitle ?? ''}
            onCommit={(v) =>
              onChange?.({ ...content, subtitle: v || undefined })
            }
            placeholder='Descrição de apoio'
            readOnly={readOnly}
            className='text-[#161c2d]/70 text-[19px] leading-[1.7] tracking-[-0.2px]'
          />
        ) : null}
      </div>

      <div className='mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2'>
        <div className='relative mx-auto aspect-[541/419] w-full max-w-[541px] overflow-hidden rounded-[8px] shadow-[0_31px_34px_-20px_rgba(0,0,0,0.09)]'>
          <GhostImage
            value={content.imageUrl}
            onUpload={handleImage}
            readOnly={readOnly}
            alt={content.title}
            className='size-full object-cover'
          />
          <div
            aria-hidden
            className='-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 flex size-[92px] items-center justify-center rounded-full bg-white shadow-lg'
          >
            <SteelIcon
              icon={PlayIcon}
              size={22}
              className='translate-x-0.5 text-[#68d585]'
            />
          </div>
        </div>

        <div className='flex flex-col gap-10'>
          {content.items.map((item, index) => (
            <div
              key={index}
              className='group/item relative flex items-start gap-4'
            >
              {!readOnly ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  className='-top-2 -right-2 absolute opacity-0 group-hover/item:opacity-100'
                  aria-label='Remover passo'
                  onClick={() => removeItem(index)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} size={14} />
                </Button>
              ) : null}
              <span className='flex size-[43px] shrink-0 items-center justify-center rounded-full bg-[#ece9fd] font-medium text-[#473bf0] text-[17px]'>
                {index + 1}
              </span>
              <div className='flex flex-col gap-2'>
                <GhostInput
                  as='h3'
                  value={item.title}
                  onCommit={(v) => updateItem(index, { title: v })}
                  placeholder='Título do passo'
                  readOnly={readOnly}
                  className='font-bold text-[#161c2d] text-[21px] tracking-[-0.5px]'
                />
                <GhostTextarea
                  value={item.description}
                  onCommit={(v) => updateItem(index, { description: v })}
                  placeholder='Descrição'
                  readOnly={readOnly}
                  as='p'
                  className='text-[#161c2d]/70 text-[17px] leading-[1.7]'
                />
              </div>
            </div>
          ))}
          {!readOnly ? (
            <button
              type='button'
              onClick={addItem}
              className='flex min-h-16 items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground text-sm hover:bg-background'
            >
              <SteelIcon icon={Add01Icon} strokeWidth={2} />
              Adicionar passo
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
