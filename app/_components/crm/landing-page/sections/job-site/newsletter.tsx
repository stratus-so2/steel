'use client'

import { Mail01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type NewsletterContent = Extract<
  CrmLandingPageSectionContent,
  { type: 'NEWSLETTER' }
>

export function newsletterDefaultContent(): NewsletterContent {
  return {
    type: 'NEWSLETTER',
    title: 'Get our latest updates',
    description:
      'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
    placeholder: 'Enter your email',
    ctaLabel: 'Subscribe',
  }
}

export function JobSiteNewsletter({
  content,
  onChange,
  readOnly,
}: LandingPageSectionProps<NewsletterContent>) {
  return (
    <section
      id='subscribe'
      className='flex flex-col items-center gap-6 px-6 py-20 text-center sm:px-12 sm:py-28'
    >
      <span className='flex size-[78px] items-center justify-center rounded-full bg-[#68d585]'>
        <SteelIcon
          icon={Mail01Icon}
          strokeWidth={2}
          size={28}
          className='text-white'
        />
      </span>

      <GhostInput
        as='h2'
        value={content.title}
        onCommit={(v) => onChange?.({ ...content, title: v })}
        placeholder='Título da seção'
        readOnly={readOnly}
        className='font-bold text-[#161c2d] text-[28px] tracking-[-1px] sm:text-[36px]'
      />
      {content.description || !readOnly ? (
        <GhostTextarea
          value={content.description ?? ''}
          onCommit={(v) =>
            onChange?.({ ...content, description: v || undefined })
          }
          placeholder='Descrição de apoio'
          readOnly={readOnly}
          as='p'
          className='max-w-md text-balance text-[#161c2d]/70 text-[17px] sm:text-[19px]'
        />
      ) : null}

      <div className='flex w-full max-w-md items-center gap-2 rounded-lg border border-[#e7e9ed] bg-white p-2'>
        <GhostInput
          value={content.placeholder ?? ''}
          onCommit={(v) =>
            onChange?.({ ...content, placeholder: v || undefined })
          }
          placeholder='Seu e-mail'
          readOnly={readOnly}
          className='flex-1 px-2 text-[#161c2d]/70 text-[15px]'
        />
        <span className='shrink-0 rounded-md bg-[#473bf0] px-6 py-3 font-bold text-[17px] text-white tracking-[-0.6px]'>
          <GhostInput
            value={content.ctaLabel ?? ''}
            onCommit={(v) =>
              onChange?.({ ...content, ctaLabel: v || undefined })
            }
            placeholder='Inscrever'
            readOnly={readOnly}
            className='text-inherit'
          />
        </span>
      </div>

      <p className='text-[#161c2d]/70 text-[15px]'>
        We&rsquo;ll never share your details with third parties. View our
        Privacy Policy for more info.
      </p>
    </section>
  )
}
