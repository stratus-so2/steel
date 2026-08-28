'use client'

import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { GhostInput } from '@/components/ui/ghost-input'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type NewsletterContent = Extract<
  CrmLandingPageSectionContent,
  { type: 'NEWSLETTER' }
>

export function consultationNewsletterDefaultContent(): NewsletterContent {
  return {
    type: 'NEWSLETTER',
    title: 'Subscribe to our newsletter to get latest news on your inbox.',
    placeholder: 'Enter your email',
    ctaLabel: 'Subscribe',
  }
}

export function ConsultationNewsletter({
  content,
  onChange,
  readOnly,
}: LandingPageSectionProps<NewsletterContent>) {
  return (
    <section className='px-6 py-16 sm:px-10 lg:px-[123px]'>
      <div className='mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center'>
        <GhostInput
          as='h2'
          value={content.title}
          onCommit={(v) => onChange?.({ ...content, title: v })}
          placeholder='Título da chamada'
          readOnly={readOnly}
          className='max-w-lg text-balance font-bold text-[#161c2d] text-[26px] leading-[1.3] tracking-[-1.2px] sm:text-[32px] sm:leading-[44px]'
        />

        <div className='flex shrink-0 items-center gap-4'>
          <GhostInput
            value={content.placeholder ?? ''}
            onCommit={(v) =>
              onChange?.({ ...content, placeholder: v || undefined })
            }
            placeholder='Enter your email'
            readOnly={readOnly}
            className='w-[290px] rounded-lg border border-[#e7e9ed] px-[19px] py-4 text-[#161c2d]/70 text-[15px] tracking-[-0.18px]'
          />
          <span className='inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#473bf0] px-6 py-4 font-bold text-[17px] text-white tracking-[-0.6px]'>
            <GhostInput
              value={content.ctaLabel ?? ''}
              onCommit={(v) =>
                onChange?.({ ...content, ctaLabel: v || undefined })
              }
              placeholder='Subscribe'
              readOnly={readOnly}
              className='text-inherit'
            />
            <SteelIcon icon={ArrowRight01Icon} strokeWidth={2.5} size={16} />
          </span>
        </div>
      </div>
    </section>
  )
}
